"""Promotion classification, referral markers and scheduled-call evidence.

Promotion intent, not a bare ref parameter, makes a post an advertisement:
casino and deposit language, partner codes and sign-up offers. Referral
parameters on genuine call links stay attached to the call as recorded
evidence for down-weighting.
"""
import re

PROMOTION_INTENT_RE = re.compile(
    r'\b(casino|slots?\b|betting|\bbet\b|deposit\s+(?:bonus|offer|now)|bonus\s+code|'
    r'promo\s+code|promotional\s+code|partner\s+code|referral\s+(?:code|bonus|link|program)|'
    r'sign-?up\s+bonus|welcome\s+bonus|1win|stake\.com|roobet|bc\.game|justbit|'
    r'use\s+(?:my|the)\s+code|claim\s+your\s+bonus|free\s+spins?|no-?deposit\s+bonus)\b',
    re.IGNORECASE)
REFERRAL_PARAM_RE = re.compile(
    r'[?&](?:ref|referral|invite|aff|affiliate|promo|s?s(?:lid)?|code)=([A-Za-z0-9_-]{2,64})|'
    r'/(?:ref|invite)/([A-Za-z0-9_-]{2,64})|'
    r'\b(?:referral|promo)\s+code[:\s]*([A-Za-z0-9_-]{2,32})\b',
    re.IGNORECASE)
SCHEDULED_CALL_RE = re.compile(
    r'\b(?:call|listing|launch|pump|raiding|entry)\s+(?:at|in|on|starts?)\s+'
    r'(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|utc|et|ist)?|in\s+\d+\s*(?:min(?:ute)?s?|hours?|hrs?|days?)|'
    r'\d{1,2}:\d{2}\s*(?:am|pm|utc|et)?)\b|'
    r'\b(?:in|after)\s+\d+\s*(?:min(?:ute)?s?|hours?|hrs?|days?)\s+(?:we\s+)?(?:call|entry|launch)\b|'
    r'\btimed\s+call\b|pre\s*announced\s*call',
    re.IGNORECASE)
CLOCK_RE = re.compile(r'\b\d{1,2}:\d{2}\s*(?:am|pm|utc|et)?\b', re.IGNORECASE)


def classify_promotion(text, urls):
    """Return (is_advertisement, filter_reason). Only promotion intent makes an ad.

    Referral parameters on call links are recorded as markers and evidence, not
    as a reason to discard a genuine call.
    """
    if PROMOTION_INTENT_RE.search(text):
        return True, 'promotional_post'
    return False, None


def collect_referral_markers(text, urls):
    """Every referral marker with its exact source, kept as evidence."""
    markers = []
    for url in urls:
        raw = url.get('url', '')
        match = REFERRAL_PARAM_RE.search(raw)
        if match:
            markers.append({'source': 'url', 'value': match.group(0), 'url': raw})
    return markers


def detect_scheduled_call(text):
    """Return scheduled-call evidence, or None. Conservative pre-announcement veto."""
    match = SCHEDULED_CALL_RE.search(text)
    if not match:
        return None
    clock = CLOCK_RE.search(match.group(0))
    return {'span': [match.start(), match.end()], 'quote': match.group(0), 'clock': clock.group(0) if clock else None}
