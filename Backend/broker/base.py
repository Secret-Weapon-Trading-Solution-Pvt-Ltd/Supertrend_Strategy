"""
broker/base.py — BrokerABC interface.
The strategy engine only talks to this interface — never imports ZerodhaBroker
or ForwardTestBroker directly. Switching between real and simulated broker is
one config line change, zero code changes elsewhere.
"""

from abc import ABC, abstractmethod
import pandas as pd


class BrokerABC(ABC):

    @abstractmethod
    def place_order(self, symbol: str, token: int, qty: int,
                    transaction_type: str, product: str,
                    order_type: str, price: float = 0,
                    exchange: str = "NSE") -> str: ...

    @abstractmethod
    def cancel_order(self, order_id: str) -> None: ...

    @abstractmethod
    def get_positions(self) -> list[dict]: ...

    @abstractmethod
    def get_holdings(self) -> list[dict]: ...

    @abstractmethod
    def get_order_status(self, order_id: str) -> dict: ...

    @abstractmethod
    def get_ltp(self, tokens: list[int]) -> dict: ...

    @abstractmethod
    def get_candles(self, instrument_token: int, interval: str,
                    candle_count: int = 100) -> pd.DataFrame: ...

    @abstractmethod
    def get_instruments(self, exchange: str) -> list[dict]: ...

    @abstractmethod
    def subscribe_ticks(self, tokens: list[int]) -> None: ...

    @abstractmethod
    def get_latest_ticks(self) -> dict: ...

    @abstractmethod
    def get_funds(self) -> dict: ...
    """Returns available funds: {live_balance, collateral, net}"""

    @abstractmethod
    def get_order_margin(self, symbol: str, qty: int, transaction_type: str,
                         product: str, exchange: str) -> float: ...
    """Returns exact margin required (₹) for a specific order."""
