"""Recorded market inputs: entry prices and liquidity, best effort, never invented.

Every observation is recorded with its source and timestamp, or recorded as
missing when a source fails. Nothing here replaces a failed source with a
substitute.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx

from shared_types.canonical import timestamp

LOG = logging.getLogger('refrain.prices')

DEFAULT_TIMEOUT = 10.0


async def fetch_json(client, url, params=None, headers=None):
    try:
        response = await client.get(url, params=params, headers=headers)
        if response.status_code != 200:
            LOG.warning('Market source %s returned %s.', url.split('/')[2] if '//' in url else url, response.status_code)
            return None
        # parse_float keeps every recorded price as the exact text the source
        # sent. Canonical bundle bytes then carry strings, never floats.
        return response.json(parse_float=str)
    except (httpx.HTTPError, ValueError) as error:
        LOG.warning('Market source failed (%s).', type(error).__name__)
        return None


def _dexscreener_pairs(data):
    if not isinstance(data, dict):
        return []
    pairs = data.get('pairs')
    return [pair for pair in (pairs or []) if isinstance(pair, dict)]


async def observe_asset(asset_key, timeout=DEFAULT_TIMEOUT):
    """Entry price and liquidity observations for a contract-address asset."""
    observations = []
    if not (asset_key.startswith('solana:') or asset_key.startswith('evm:')):
        return observations
    network = 'solana' if asset_key.startswith('solana:') else 'ethereum'
    address = asset_key.split(':', 1)[1] if ':' in asset_key else asset_key
    address = address.split(':', 1)[1] if address.startswith('evm:') else address
    if address.startswith('evm:'):
        address = address.split(':', 1)[1]
    async with httpx.AsyncClient(timeout=timeout) as client:
        dexscreener = await fetch_json(client, f'https://api.dexscreener.com/latest/dex/tokens/{address}')
        pairs = _dexscreener_pairs(dexscreener)
        best = None
        for pair in pairs:
            chain = (pair.get('chainId') or '').lower()
            if chain != network and not (network == 'solana' and chain == 'solana'):
                continue
            base_token = ((pair.get('baseToken') or {}).get('address') or '')
            if base_token.lower() != address.lower():
                # priceUsd belongs to the pair's base token; a pair where the
                # queried token is the quote side would record another asset's
                # price.
                continue
            liquidity = (pair.get('liquidity') or {}).get('usd')
            if liquidity is not None and (best is None or liquidity > best[0]):
                best = (liquidity, pair)
        if best:
            liquidity, pair = best
            price = pair.get('priceUsd')
            observations.append({
                'kind': 'dexscreener',
                'locator': f"{pair.get('chainId')}:{pair.get('pairAddress')}",
                'observedAt': timestamp(datetime.now(timezone.utc)),
                'liquidityUsdCents': int(round(float(liquidity) * 100)) if liquidity is not None else None,
                'price': price if price is not None else None,
            })
        gecko = await fetch_json(
            client,
            f'https://api.geckoterminal.com/api/v2/networks/{network}/tokens/{address}/pools',
            headers={'accept': 'application/json'})
        token_id = f'{network}_{address}'
        best_pool = None
        for entry in (gecko or {}).get('data', []):
            attributes = entry.get('attributes') or {}
            relationships = entry.get('relationships') or {}
            base_id = ((relationships.get('base_token') or {}).get('data') or {}).get('id')
            quote_id = ((relationships.get('quote_token') or {}).get('data') or {}).get('id')
            if base_id == token_id:
                price = attributes.get('base_token_price_usd')
            elif quote_id == token_id:
                price = attributes.get('quote_token_price_usd')
            else:
                continue
            reserve = attributes.get('reserve_in_usd')
            if price is None or reserve is None:
                continue
            if best_pool is None or float(reserve) > float(best_pool[0]):
                best_pool = (reserve, price, entry)
        if best_pool:
            reserve, price, pool = best_pool
            observations.append({
                'kind': 'geckoterminal',
                'locator': f'{network}:{pool.get("attributes", {}).get("address") or pool.get("id")}',
                'observedAt': timestamp(datetime.now(timezone.utc)),
                'liquidityUsdCents': int(round(float(reserve) * 100)),
                'price': price,
            })
    return observations


async def observe_pair(pair, timeout=DEFAULT_TIMEOUT):
    """Entry price observations for a listed USDT pair from two exchanges."""
    observations = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        binance = await fetch_json(client, 'https://api.binance.com/api/v3/ticker/price',
                                   params={'symbol': pair})
        if binance and binance.get('price'):
            observations.append({
                'kind': 'binance', 'locator': pair,
                'observedAt': timestamp(datetime.now(timezone.utc)),
                'liquidityUsdCents': None, 'price': binance['price'],
            })
        bybit = await fetch_json(client, 'https://api.bybit.com/v5/market/tickers',
                                 params={'category': 'spot', 'symbol': pair})
        rows = (bybit or {}).get('result', {}).get('list', [])
        if rows and rows[0].get('lastPrice'):
            observations.append({
                'kind': 'bybit', 'locator': pair,
                'observedAt': timestamp(datetime.now(timezone.utc)),
                'liquidityUsdCents': None, 'price': rows[0]['lastPrice'],
            })
    return observations


async def observe(bundle, timeout=DEFAULT_TIMEOUT):
    """Recorded entry observations and liquidity for one bundle's price plan."""
    asset_key = bundle['asset'].get('assetKey')
    if asset_key and asset_key.startswith('cex:'):
        entry = await observe_pair(asset_key.split(':', 1)[1], timeout)
        return entry, []
    liquidity = await observe_asset(asset_key, timeout)
    entry = [row for row in liquidity if row.get('price') is not None]
    return entry, liquidity
