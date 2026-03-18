"""
broker/factory.py — Broker factory.

Returns the correct broker based on settings.broker_mode:
  "forward_test" → ForwardTestBroker (wraps ZerodhaBroker for market data)
  "live"         → ZerodhaBroker (real orders on Zerodha)

Usage:
    from broker.factory import create_broker
    broker = create_broker(access_token)
"""

import logging
from broker.zerodha import ZerodhaBroker
from broker.forward_test import ForwardTestBroker
from broker.base import BrokerABC
from config.settings import settings

log = logging.getLogger(__name__)


def create_broker(access_token: str) -> BrokerABC:
    """
    Factory — returns correct broker based on settings.broker_mode.

    Args:
        access_token: Zerodha access token from DB

    Returns:
        BrokerABC instance (ZerodhaBroker or ForwardTestBroker)
    """
    # Always create real broker — needed for market data in both modes
    real_broker = ZerodhaBroker()
    real_broker.set_access_token(access_token)

    if settings.broker_mode == "live":
        log.info("Broker mode: LIVE — real orders will be placed on Zerodha")
        return real_broker

    # Default: forward_test
    log.info("Broker mode: FORWARD TEST — simulated orders, no real money")
    return ForwardTestBroker(zerodha_broker=real_broker)
