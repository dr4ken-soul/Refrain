# Local environment setup

The actual private configuration is the repository-root `.env`. It is ignored by Git. Do not paste its contents into chat, screenshots, issue trackers or commits. Keep server-only credentials out of every `NEXT_PUBLIC_*` variable.

This guide explains provisioning. It does not claim that any connection or deployment has succeeded.

## Groq extraction model

Groq is compatible with the planned OpenAI-compatible extraction client. The local `.env` now selects:

```dotenv
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-20b
```

Create a key at https://console.groq.com/keys and save it locally as `LLM_API_KEY`. Do not add it to browser configuration.

GPT-OSS 20B is the starting model for low-latency extraction. GPT-OSS 120B is an optional model to evaluate against the fixture suite if extraction quality needs improvement. Both support strict JSON Schema structured outputs. The extractor must still validate the response and spans, reject malformed data, handle refusals and truncation, and never repair output by guessing. No LLM request has been tested yet.

The account limits supplied by the owner include 30 requests per minute, 1,000 requests per day, 8,000 tokens per minute and 200,000 tokens per day for the two GPT-OSS models. Requests consume both token and request budgets. These limits are ceilings, not target throughput or guaranteed capacity. The implementation must parse deterministically first, cache by content hash and extraction version, queue remaining work, and respect rate-limit headers and retry timing. Do not assume that changing models gives an independent quota.

The speech, prompt-guard and safeguard models are not substitutes for the primary structured market-call extractor.

References:

- https://console.groq.com/docs/openai
- https://console.groq.com/docs/structured-outputs

## Supabase database

Use the PostgreSQL connection string from Dashboard > Connect > Session pooler. The project's HTTPS URL is not a PostgreSQL connection string.

For this project, the supplied session-pooler connection has this form:

```text
postgresql://postgres.nkzehmorkoenuzftavhc:ENCODED_DATABASE_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Replace `ENCODED_DATABASE_PASSWORD` with the database password, percent-encoding reserved characters in the password component only. Save the full resulting URI as `DATABASE_URL`. Do not include the literal placeholder or brackets. Use the project's database password, not an anon key, publishable key, service-role key or Supabase account-login password. If forgotten, reset the database password through the project dashboard and update dependent services.

Session pooling on port 5432 is suitable for a persistent FastAPI service and collector on IPv4. The direct connection is preferred for native migrations and backup tooling when reachable; take that URI from the same Connect panel. Do not confuse session pooling with transaction pooling on port 6543.

The HTTPS project URL is for Supabase's HTTP APIs and is not needed as DATABASE_URL in this architecture.

Reference: https://supabase.com/docs/guides/database/connecting-to-postgres

## Ethereum RPC endpoints

Alchemy can supply both required endpoints. Infura and other Ethereum JSON-RPC providers are also suitable.

1. Sign in at https://dashboard.alchemy.com/ and create or select an app.
2. Enable Ethereum Sepolia and copy its HTTPS RPC endpoint into `SEPOLIA_RPC_URL`.
3. Enable Ethereum Mainnet and copy its HTTPS RPC endpoint into `ETHEREUM_MAINNET_RPC_URL`.

Alchemy's endpoint forms are:

```text
Sepolia: https://eth-sepolia.g.alchemy.com/v2/ALCHEMY_API_KEY
Mainnet: https://eth-mainnet.g.alchemy.com/v2/ALCHEMY_API_KEY
```

Copy the actual dashboard endpoints, not the examples above. Mainnet is for read-only price-feed calls. Do not send a transaction to mainnet. Chain ID is 11155111 on Sepolia and 1 on Ethereum Mainnet; the deployment and runner must verify chain ID before signing.

`NEXT_PUBLIC_SEPOLIA_RPC_URL` is optional until a browser-side chain read needs it. A NEXT_PUBLIC value is visible to visitors. Do not copy an unrestricted private provider key there. Prefer server-side chain reads through the API, or use a separate browser-scoped endpoint with appropriate provider restrictions.

Reference: https://www.alchemy.com/docs/reference/node-supported-chains

## Sepolia signer

There is no separate CRE ETH token for Sepolia gas. Ordinary Sepolia ETH funds contract deployment and CRE simulation broadcasts.

`CRE_ETH_PRIVATE_KEY` is the private key of the dedicated simulation signer. It is not an RPC API key, Chainlink account key or wallet address. The owner has populated this field; it has not been displayed or used to sign anything during setup.

An Ethereum private key works across EVM networks. Selecting Sepolia does not make a private key cryptographically testnet-only. Use a dedicated disposable account that has never held valuable assets and is never used on mainnet. If the populated key is a personal or valuable wallet key, replace it locally before any deployment. Fund the new address with Sepolia ETH from the existing account if necessary. Never share a seed phrase.

## Telegram

1. Use the dedicated secondary Telegram account required by the project specification.
2. Open https://my.telegram.org and sign in with that account.
3. Under API development tools, register an application.
4. Save its numeric API ID as `TELEGRAM_API_ID` and its API hash as `TELEGRAM_API_HASH`.
5. Keep `TELEGRAM_SESSION_PATH=./.local/telegram/refrain.session` for local use. It is a file path, not a value from Telegram.
6. The implemented collector's first interactive login will create the session file after the operator completes Telegram's code and any two-step verification. No collector or login command is implemented yet.

Do not substitute a BotFather bot token. The specified history collector uses Telethon and an operator account.

## Values already generated or set locally

- `CRE_BEARER_SECRET`: generated server secret for the workflow API endpoints. Later, provision the same value through the CRE secret mechanism without committing the value.
- `OPERATOR_SECRET`: separate generated server secret for operator sign-in.
- `API_BASE_URL`: local FastAPI URL, currently http://localhost:8000. Replace it with the reachable hosted API URL for hosted workflows.
- `NEXT_PUBLIC_API_BASE_URL`: browser-reachable API URL, currently http://localhost:8000. Replace it for deployment.
- `NEXT_PUBLIC_CHAIN_ID`: 11155111.
- `PRICE_FETCH_TIMEOUT_SECONDS`: 10.

## Values produced later

Leave `REFRAIN_LEDGER_ADDRESS` and `NEXT_PUBLIC_REFRAIN_LEDGER_ADDRESS` empty until RefrainLedger has actually deployed on Sepolia. The deployment receipt supplies the address. A wallet address is not a substitute.

Public web and API deployment URLs, an Etherscan verification API key if the verification tooling requires it, and authenticated GitHub, hosting and DoraHacks access will be needed during their respective build phases. None of these is evidence that the current application is deployed.

## CRE account login

After CLI installation, open a new terminal and run `cre version`, then `cre login`. Complete the account flow yourself. Installation alone does not create or authenticate a Chainlink account and does not prove that simulation or broadcast works.
