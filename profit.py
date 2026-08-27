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

COPPER = Sellable("Copper", 1, [])
IRON = Sellable("Iron", 2, [])
LEAD = Sellable("Lead", 4, [])
SILICON = Sellable("Silicon", 8, [])
ALUMINUM = Sellable("Aluminum", 17, [])
SILVER = Sellable("Silver", 36, [])
GOLD = Sellable("Gold", 75, [])
DIAMOND = Sellable("Diamond", 160, [])
PLATINUM = Sellable("Platinum", 340, [])
TITANIUM = Sellable("Titanium", 730, [])
IRIDIUM = Sellable("Iridium", 1_600, [])
PALLADIUM = Sellable("Palladium", 3_500, [])
OSMIUM = Sellable("Osmium", 7_800, [])
RHODIUM = Sellable("Rhodium", 17_500, [])
INERTON = Sellable("Inerton", 40_000, [])
QUADIUM = Sellable("Quadium", 92_000, [])
SCRITH = Sellable("Scrith", 215_000, [])
URU = Sellable("Uru", 510_000, [])
VIBRANIUM = Sellable("Vibranium", 1_250_000, [])
AETHER = Sellable("Aether", 3_200_000, [])
VITERIUM = Sellable("Viterium", 9_000_000, [])
XYNIUM = Sellable("Xynium", 28_000_000, [])
QUOLIUM = Sellable("Quolium", 90_000_000, [])
LUTERIUM = Sellable("Luterium", 300_000_000, [])
WRAITH = Sellable("Wraith", 1_100_000_000, [])
AQUALITE = Sellable("Aqualite", 4_300_000_000, [])
OPALITE = Sellable("Opalite", 18_000_000_000, [])

COPPER_BAR = Sellable("Copper Bar", 1_450, [(COPPER, 1_000)], time_to_make=20)
IRON_BAR = Sellable("Iron Bar", 3_000, [(IRON, 1_000)], time_to_make=30)
LEAD_BAR = Sellable("Lead Bar", 6_100, [(LEAD, 1_000)], time_to_make=40)
SILICON_BAR = Sellable("Silicon Bar", 12_500, [(SILICON, 1_000)], time_to_make=60)
ALUMINUM_BAR = Sellable("Aluminum Bar", 27_600, [(ALUMINUM, 1_000)], time_to_make=80)
SILVER_BAR = Sellable("Silver Bar", 60_000, [(SILVER, 1_000)], time_to_make=120)
GOLD_BAR = Sellable("Gold Bar", 120_000, [(GOLD, 1_000)], time_to_make=180)
BRONZE_BAR = Sellable("Bronze Bar", 234_000, [(SILVER_BAR, 2), (COPPER_BAR, 10)], time_to_make=240)
STEEL_BAR = Sellable("Steel Bar", 340_000, [(LEAD_BAR, 15), (IRON_BAR, 30)], time_to_make=480)
PLATINUM_BAR = Sellable("Platinum Bar", 780_000, [(GOLD_BAR, 2), (PLATINUM, 1_000)], time_to_make=600)
TITANIUM_BAR = Sellable("Titanium Bar", 1_630_000, [(BRONZE_BAR, 2), (TITANIUM, 1_000)], time_to_make=720)
IRIDIUM_BAR = Sellable("Iridium Bar", 3_110_000, [(STEEL_BAR, 2), (IRIDIUM, 1_000)], time_to_make=840)
PALLADIUM_BAR = Sellable("Palladium Bar", 7_000_000, [(PLATINUM_BAR, 2), (PALLADIUM, 1_000)], time_to_make=960)
OSMIUM_BAR = Sellable("Osmium Bar", 14_500_000, [(TITANIUM_BAR, 2), (OSMIUM, 1_000)], time_to_make=1_080)
RHODIUM_BAR = Sellable("Rhodium Bar", 31_000_000, [(IRIDIUM_BAR, 2), (RHODIUM, 1_000)], time_to_make=1_200)
INERTON_ALLOY = Sellable("Inerton Alloy", 68_000_000, [(PALLADIUM_BAR, 2), (INERTON, 1_000)], time_to_make=1_440)
QUADIUM_ALLOY = Sellable("Quadium Alloy", 152_000_000, [(OSMIUM_BAR, 2), (QUADIUM, 1_000)], time_to_make=1_680)
SCRITH_ALLOY = Sellable("Scrith Alloy", 352_000_000, [(RHODIUM_BAR, 2), (SCRITH, 1_000)], time_to_make=1_920)
URU_ALLOY = Sellable("Uru Alloy", 832_000_000, [(INERTON_ALLOY, 2), (URU, 1_000)], time_to_make=2_160)
VIBRANIUM_ALLOY = Sellable("Vibranium Alloy", 2_050_000_000, [(QUADIUM_ALLOY, 2), (VIBRANIUM, 1_000)], time_to_make=2_400)
AETHER_ALLOY = Sellable("Aether Alloy", 5_120_000_000, [(SCRITH_ALLOY, 2), (AETHER, 1_000)], time_to_make=2_640)
VITERIUM_ALLOY = Sellable("Viterium Alloy", 15_500_000_000, [(URU_ALLOY, 2), (VITERIUM, 1_000)], time_to_make=2_880)
XYNIUM_ALLOY = Sellable("Xynium Alloy", 48_000_000_000, [(VIBRANIUM_ALLOY, 5), (XYNIUM, 1_500)], time_to_make=3_300)
QUOLIUM_ALLOY = Sellable("Quolium Alloy", 160_000_000_000, [(AETHER_ALLOY, 5), (QUOLIUM, 1_500)], time_to_make=3_720)
LUTERIUM_ALLOY = Sellable("Luterium Alloy", 600_000_000_000, [(VITERIUM_ALLOY, 5), (LUTERIUM, 1_500)], time_to_make=4_140)
WRAITH_ALLOY = Sellable("Wraith Alloy", 2_400_000_000_000, [(XYNIUM_ALLOY, 5), (WRAITH, 1_500)], time_to_make=4_560)
AQUALITE_ALLOY = Sellable("Aqualite Alloy", 17_500_000_000_000, [(QUOLIUM_ALLOY, 5), (AQUALITE, 1_500)], time_to_make=4_980)
OPALITE_ALLOY = Sellable("Opalite Alloy", 277_000_000_000_000, [(WRAITH_ALLOY, 5), (OPALITE, 1_500)], time_to_make=5_520)

SELLABLES = [
    COPPER,
    IRON,
    LEAD,
    SILICON,
    ALUMINUM,
    SILVER,
    GOLD,
    DIAMOND,
    PLATINUM,
    TITANIUM,
    IRIDIUM,
    PALLADIUM,
    OSMIUM,
    RHODIUM,
    INERTON,
    QUADIUM,
    SCRITH,
    URU,
    VIBRANIUM,
    AETHER,
    VITERIUM,
    XYNIUM,
    QUOLIUM,
    LUTERIUM,
    WRAITH,
    AQUALITE,
    OPALITE,
    COPPER_BAR,
    IRON_BAR,
    LEAD_BAR,
    SILICON_BAR,
    ALUMINUM_BAR,
    SILVER_BAR,
    GOLD_BAR,
    BRONZE_BAR,
    STEEL_BAR,
    PLATINUM_BAR,
    TITANIUM_BAR,
    IRIDIUM_BAR,
    PALLADIUM_BAR,
    OSMIUM_BAR,
    RHODIUM_BAR,
    INERTON_ALLOY,
    QUADIUM_ALLOY,
    SCRITH_ALLOY,
    URU_ALLOY,
    VIBRANIUM_ALLOY,
    AETHER_ALLOY,
    VITERIUM_ALLOY,
    XYNIUM_ALLOY,
    QUOLIUM_ALLOY,
    LUTERIUM_ALLOY,
    WRAITH_ALLOY,
    AQUALITE_ALLOY,
    OPALITE_ALLOY,
]
