from __future__ import annotations

class Sellable:
    def __init__(
        self,
        name: str,
        price: float,
        inputs: list[tuple[Sellable, int]], # list of (sellable, amount) tuples
        time_to_make: int = 1, # number of seconds
    ):
        self.name = name
        self.price = price
        self.inputs = inputs
        self.time_to_make = time_to_make

    def get_input_cost(self):
        input_cost = 0
        for sellable, amount in self.inputs:
            c = sellable.get_input_cost()
            input_cost += c * amount
        return input_cost

    def get_profit_per_second(self):
        profit = self.price - self.get_input_cost()
        return profit / self.time_to_make

SELLABLES = [
    Sellable("Copper", 1, []),
    Sellable("Iron", 2, []),
    Sellable("Lead", 4, []),
    Sellable("Silicon", 8, []),
    Sellable("Aluminum", 17, []),
    Sellable("Silver", 36, []),
    Sellable("Gold", 75, []),
    Sellable("Diamond", 160, []),
    Sellable("Platinum", 340, []),
    Sellable("Titanium", 730, []),
    Sellable("Iridium", 1_600, []),
    Sellable("Palladium", 3_500, []),
    Sellable("Osmium", 7_800, []),
    Sellable("Rhodium", 17_500, []),
    Sellable("Inerton", 40_000, []),
    Sellable("Quadium", 92_000, []),
    Sellable("Scrith", 215_000, []),
    Sellable("Uru", 510_000, []),
    Sellable("Vibranium", 1_250_000, []),
    Sellable("Aether", 3_200_000, []),
    Sellable("Viterium", 9_000_000, []),
    Sellable("Xynium", 28_000_000, []),
    Sellable("Quolium", 90_000_000, []),
    Sellable("Luterium", 300_000_000, []),
    Sellable("Wraith", 1_100_000_000, []),
    Sellable("Aqualite", 4_300_000_000, []),
    Sellable("Opalite", 18_000_000_000, []),
]
