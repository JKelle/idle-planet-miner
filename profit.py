from __future__ import annotations
from typing import Optional
import matplotlib.pyplot as plt

class Sellable:
    def __init__(
        self,
        name: str,
        base_sell_price: float,
        ingredients: Optional[list[tuple[Sellable, int]]] = None, # list of (sellable, amount) tuples
        smelt_time: int = 0, # number of seconds
        stars: int = 0,
    ):
        self.name = name
        self.base_sell_price = base_sell_price
        self.ingredients = ingredients or []
        self.smelt_time = smelt_time
        self.stars = stars
        SELLABLES.append(self)

    def get_sell_price(self) -> float:
        # Each star adds 20% to the sell price
        return self.base_sell_price * (1 + 0.2 * self.stars)

    def get_input_costs(self) -> tuple[float, int]:
        """Returns sell_price and smelt time (in seconds)"""
        ing_sell_price = 0
        ing_smelt_time = 0
        for ing, amount in self.ingredients:
            ing_sell_price += ing.get_sell_price() * amount
            ing_smelt_time += ing.smelt_time * amount

        return ing_sell_price, ing_smelt_time

    def get_profit_per_second(self):
        """Returns units of dollars per second"""
        ing_sell_price, ing_smelt_time = self.get_input_costs()
        profit = self.get_sell_price() - ing_sell_price
        total_smelt_time = ing_smelt_time + self.smelt_time

        return profit / total_smelt_time

SELLABLES: list[Sellable] = []

########
# Ores #
########
COPPER = Sellable("Copper Ore", 1, stars=2)
IRON = Sellable("Iron Ore", 2, stars=5)
LEAD = Sellable("Lead Ore", 4, stars=2)
SILICON = Sellable("Silicon Ore", 8, stars=2)
ALUMINUM = Sellable("Aluminum Ore", 17, stars=4)
SILVER = Sellable("Silver Ore", 36, stars=1)
GOLD = Sellable("Gold Ore", 75, stars=3)
DIAMOND = Sellable("Diamond Ore", 160, stars=2)
PLATINUM = Sellable("Platinum Ore", 340, stars=7)
TITANIUM = Sellable("Titanium Ore", 730, stars=4)
IRIDIUM = Sellable("Iridium Ore", 1_600, stars=3)
PALLADIUM = Sellable("Palladium Ore", 3_500, stars=5)
OSMIUM = Sellable("Osmium Ore", 7_800, stars=1)
RHODIUM = Sellable("Rhodium", 17_500, stars=0)
INERTON = Sellable("Inerton", 40_000, stars=0)
# QUADIUM = Sellable("Quadium", 92_000)
# SCRITH = Sellable("Scrith", 215_000)
# URU = Sellable("Uru", 510_000)
# VIBRANIUM = Sellable("Vibranium", 1_250_000)
# AETHER = Sellable("Aether", 3_200_000)
# VITERIUM = Sellable("Viterium", 9_000_000)
# XYNIUM = Sellable("Xynium", 28_000_000)
# QUOLIUM = Sellable("Quolium", 90_000_000)
# LUTERIUM = Sellable("Luterium", 300_000_000)
# WRAITH = Sellable("Wraith", 1_100_000_000)
# AQUALITE = Sellable("Aqualite", 4_300_000_000)
# OPALITE = Sellable("Opalite", 18_000_000_000)

##########
# ALLOYS #
##########
COPPER_BAR = Sellable("Copper Bar", 1_450, [(COPPER, 1_000)], smelt_time=20, stars=0)
IRON_BAR = Sellable("Iron Bar", 3_000, [(IRON, 1_000)], smelt_time=30, stars=6)
LEAD_BAR = Sellable("Lead Bar", 6_100, [(LEAD, 1_000)], smelt_time=40, stars=5)
SILICON_BAR = Sellable("Silicon Bar", 12_500, [(SILICON, 1_000)], smelt_time=60, stars=4)
ALUMINUM_BAR = Sellable("Aluminum Bar", 27_600, [(ALUMINUM, 1_000)], smelt_time=80, stars=2)
SILVER_BAR = Sellable("Silver Bar", 60_000, [(SILVER, 1_000)], smelt_time=120, stars=4)
GOLD_BAR = Sellable("Gold Bar", 120_000, [(GOLD, 1_000)], smelt_time=180, stars=7)
BRONZE_BAR = Sellable("Bronze Bar", 234_000, [(SILVER_BAR, 2), (COPPER_BAR, 10)], smelt_time=240, stars=1)
STEEL_BAR = Sellable("Steel Bar", 340_000, [(LEAD_BAR, 15), (IRON_BAR, 30)], smelt_time=480, stars=2)
PLATINUM_BAR = Sellable("Platinum Bar", 780_000, [(GOLD_BAR, 2), (PLATINUM, 1_000)], smelt_time=600, stars=4)
TITANIUM_BAR = Sellable("Titanium Bar", 1_630_000, [(BRONZE_BAR, 2), (TITANIUM, 1_000)], smelt_time=720, stars=6)
IRIDIUM_BAR = Sellable("Iridium Bar", 3_110_000, [(STEEL_BAR, 2), (IRIDIUM, 1_000)], smelt_time=840, stars=1)
PALLADIUM_BAR = Sellable("Palladium Bar", 7_000_000, [(PLATINUM_BAR, 2), (PALLADIUM, 1_000)], smelt_time=960, stars=1)
OSMIUM_BAR = Sellable("Osmium Bar", 14_500_000, [(TITANIUM_BAR, 2), (OSMIUM, 1_000)], smelt_time=1_080, stars=4)
RHODIUM_BAR = Sellable("Rhodium Bar", 31_000_000, [(IRIDIUM_BAR, 2), (RHODIUM, 1_000)], smelt_time=1_200, stars=2)
INERTON_ALLOY = Sellable("Inerton Alloy", 68_000_000, [(PALLADIUM_BAR, 2), (INERTON, 1_000)], smelt_time=1_440, stars=2)
# QUADIUM_ALLOY = Sellable("Quadium Alloy", 152_000_000, [(OSMIUM_BAR, 2), (QUADIUM, 1_000)], smelt_time=1_680)
# SCRITH_ALLOY = Sellable("Scrith Alloy", 352_000_000, [(RHODIUM_BAR, 2), (SCRITH, 1_000)], smelt_time=1_920)
# URU_ALLOY = Sellable("Uru Alloy", 832_000_000, [(INERTON_ALLOY, 2), (URU, 1_000)], smelt_time=2_160)
# VIBRANIUM_ALLOY = Sellable("Vibranium Alloy", 2_050_000_000, [(QUADIUM_ALLOY, 2), (VIBRANIUM, 1_000)], smelt_time=2_400)
# AETHER_ALLOY = Sellable("Aether Alloy", 5_120_000_000, [(SCRITH_ALLOY, 2), (AETHER, 1_000)], smelt_time=2_640)
# VITERIUM_ALLOY = Sellable("Viterium Alloy", 15_500_000_000, [(URU_ALLOY, 2), (VITERIUM, 1_000)], smelt_time=2_880)
# XYNIUM_ALLOY = Sellable("Xynium Alloy", 48_000_000_000, [(VIBRANIUM_ALLOY, 5), (XYNIUM, 1_500)], smelt_time=3_300)
# QUOLIUM_ALLOY = Sellable("Quolium Alloy", 160_000_000_000, [(AETHER_ALLOY, 5), (QUOLIUM, 1_500)], smelt_time=3_720)
# LUTERIUM_ALLOY = Sellable("Luterium Alloy", 600_000_000_000, [(VITERIUM_ALLOY, 5), (LUTERIUM, 1_500)], smelt_time=4_140)
# WRAITH_ALLOY = Sellable("Wraith Alloy", 2_400_000_000_000, [(XYNIUM_ALLOY, 5), (WRAITH, 1_500)], smelt_time=4_560)
# AQUALITE_ALLOY = Sellable("Aqualite Alloy", 17_500_000_000_000, [(QUOLIUM_ALLOY, 5), (AQUALITE, 1_500)], smelt_time=4_980)
# OPALITE_ALLOY = Sellable("Opalite Alloy", 277_000_000_000_000, [(WRAITH_ALLOY, 5), (OPALITE, 1_500)], smelt_time=5_520)

ALLOYS_END = len(SELLABLES)

#########
# ITEMS #
#########
COPPER_WIRE = Sellable("Copper Wire", 10_000, [(COPPER_BAR, 5)], smelt_time=60)
IRON_NAILS = Sellable("Iron Nails", 20_000, [(IRON_BAR, 5)], smelt_time=120)
BATTERY = Sellable("Battery", 70_000, [(COPPER_WIRE, 2), (COPPER_BAR, 10)], smelt_time=240)
HAMMER = Sellable("Hammer", 135_000, [(IRON_NAILS, 2), (LEAD_BAR, 5)], smelt_time=480)
GLASS = Sellable("Glass", 220_000, [(SILICON_BAR, 10)], smelt_time=720)
CIRCUIT = Sellable("Circuit", 620_000, [(SILICON_BAR, 5), (ALUMINUM_BAR, 5), (COPPER_WIRE, 10)], smelt_time=1_200)
LENS = Sellable("Lens", 1_100_000, [(GLASS, 1), (SILVER_BAR, 5)], smelt_time=2_400)
LASER = Sellable("Laser", 3_200_000, [(GOLD_BAR, 5), (LENS, 1), (IRON_BAR, 10)], smelt_time=3_600)
BASIC_COMPUTER = Sellable("Basic Computer", 7_600_000, [(CIRCUIT, 5), (SILVER_BAR, 5)], smelt_time=4_800)
SOLAR_PANEL = Sellable("Solar Panel", 12_500_000, [(CIRCUIT, 5), (GLASS, 10)], smelt_time=6_000)
LASER_TORCH = Sellable("Laser Torch", 31_000_000, [(BRONZE_BAR, 5), (LASER, 2), (LENS, 5)], smelt_time=7_200)
ADVANCED_BATTERY = Sellable("Advanced Battery", 35_000_000, [(STEEL_BAR, 20), (BATTERY, 30)], smelt_time=9_000)
THERMAL_SCANNER = Sellable("Thermal Scanner", 71_500_000, [(PLATINUM_BAR, 5), (LASER, 2), (GLASS, 5)], smelt_time=10_800)
ADVANCED_COMPUTER = Sellable("Advanced Computer", 180_000_000, [(TITANIUM_BAR, 5), (BASIC_COMPUTER, 5)], smelt_time=12_600)
NAVIGATION_MODULE = Sellable("Navigation Module", 1_000_000_000, [(THERMAL_SCANNER, 1), (LASER_TORCH, 2)], smelt_time=13_500)
PLASMA_TORCH = Sellable("Plasma Torch", 1_150_000_000, [(IRIDIUM_BAR, 15), (LASER_TORCH, 5)], smelt_time=15_000)
RADIO_TOWER = Sellable("Radio Tower", 1_450_000_000, [(PLATINUM_BAR, 75), (ALUMINUM_BAR, 150), (TITANIUM_BAR, 50)], smelt_time=15_600)
TELESCOPE = Sellable("Telescope", 2_700_000_000, [(LENS, 20), (ADVANCED_COMPUTER, 1)], smelt_time=16_800)
SATELLITE_DISH = Sellable("Satellite Dish", 3_400_000_000, [(STEEL_BAR, 150), (PALLADIUM_BAR, 30)], smelt_time=18_000)
MOTOR = Sellable("Motor", 7_000_000_000, [(BRONZE_BAR, 500), (HAMMER, 200)], smelt_time=19_200)
ACCUMULATOR = Sellable("Accumulator", 12_000_000_000, [(OSMIUM_BAR, 20), (ADVANCED_BATTERY, 3)], smelt_time=20_400)
NUCLEAR_CAPSULE = Sellable("Nuclear Capsule", 26_000_000_000, [(RHODIUM_BAR, 5), (PLASMA_TORCH, 1)], smelt_time=21_000)
WIND_TURBINE = Sellable("Wind Turbine", 140_000_000_000, [(ALUMINUM_BAR, 300), (MOTOR, 1)], smelt_time=21_600)
SPACE_PROBE = Sellable("Space Probe", 180_000_000_000, [(SATELLITE_DISH, 1), (TELESCOPE, 1), (SOLAR_PANEL, 25)], smelt_time=22_200)
NUCLEAR_REACTOR = Sellable("Nuclear Reactor", 1_000_000_000_000, [(NUCLEAR_CAPSULE, 1), (IRIDIUM_BAR, 300)], smelt_time=22_800)
# COLLIDER = Sellable("Collider", 2_000_000_000_000, [(INERTON_ALLOY, 500), (QUADIUM_ALLOY, 100)], time_to_make=23_100)
# GRAVITY_CHAMBER = Sellable("Gravity Chamber", 15_000_000_000_000, [(ADVANCED_COMPUTER, 60), (NUCLEAR_REACTOR, 1)], time_to_make=24_300)
# ROBOT = Sellable("Robot", 50_000_000_000_000, [(SCRITH_ALLOY, 300), (ACCUMULATOR, 90)], time_to_make=26_000)
# FUSION_CAPSULE = Sellable("Fusion Capsule", 240_000_000_000_000, [(URU_ALLOY, 200), (VIBRANIUM_ALLOY, 100), (NUCLEAR_CAPSULE, 100)], time_to_make=27_000)
# TELEPORTER = Sellable("Teleporter", 1_800_000_000_000_000, [(NAVIGATION_MODULE, 250), (GRAVITY_CHAMBER, 1)], time_to_make=29_000)
# FUSION_REACTOR = Sellable("Fusion Reactor", 40_000_000_000_000_000, [(FUSION_CAPSULE, 1), (COLLIDER, 40), (NUCLEAR_REACTOR, 50)], time_to_make=31_000)
# SUBSPACE_RELAY = Sellable("Subspace Relay", 1_000_000_000_000_000_000, [(SPACE_PROBE, 70), (SATELLITE_DISH, 100), (TELEPORTER, 1)], time_to_make=32_300)
# ADVANCED_ROBOT = Sellable("Advanced Robot", 29_500_000_000_000_000_000, [(ROBOT, 100), (FUSION_REACTOR, 5)], time_to_make=62_300)
# ADVANCED_TELEPORTER = Sellable("Advanced Teleporter", 650_000_000_000_000_000_000, [(SUBSPACE_RELAY, 5), (TELEPORTER, 100), (XYNIUM_ALLOY, 1_000)], time_to_make=115_200)
# QUANTUM_CPU = Sellable("Quantum CPU", 14_000_000_000_000_000_000_000, [(ADVANCED_ROBOT, 4), (QUOLIUM_ALLOY, 500)], time_to_make=120_000)
# DEFLECTOR_SHIELD = Sellable("Deflector Shield", 320_000_000_000_000_000_000_000, [(ADVANCED_TELEPORTER, 4), (LUTERIUM_ALLOY, 400)], time_to_make=125_000)
# WARP_CORE = Sellable("Warp Core", 6_800_000_000_000_000_000_000_000, [(WIND_TURBINE, 160), (FUSION_REACTOR, 40), (QUANTUM_CPU, 4)], time_to_make=180_000)
# DEEP_SPACE_SCANNER = Sellable("Deep Space Scanner", 145_000_000_000_000_000_000_000_000, [(ADVANCED_BATTERY, 250), (AQUALITE_ALLOY, 1_000), (DEFLECTOR_SHIELD, 4)], time_to_make=188_000)
# ANTIMATTER_CELL = Sellable("Antimatter Cell", 3_200_000_000_000_000_000_000_000_000, [(NUCLEAR_REACTOR, 50), (PALLADIUM_BAR, 10_000), (WARP_CORE, 4)], time_to_make=194_000)
# ATMOSPHERIC_PROCESSOR = Sellable("Atmospheric Processor", 68_000_000_000_000_000_000_000_000_000, [(IRIDIUM_BAR, 10_000), (DEEP_SPACE_SCANNER, 4), (QUANTUM_CPU, 15)], time_to_make=244_000)
# ORBITAL_DOCK = Sellable("Orbital Dock", 2_800_000_000_000_000_000_000_000_000_000, [(WRAITH_ALLOY, 6_000), (ANTIMATTER_CELL, 4), (WARP_CORE, 10)], time_to_make=399_000)
# SOLAR_COLLECTOR = Sellable("Solar Collector", 2_800_000_000_000_000_000_000_000_000_000, [(SOLAR_PANEL, 1_000), (DEFLECTOR_SHIELD, 20), (DEEP_SPACE_SCANNER, 132)], time_to_make=399_000)
# PHASE_GATE = Sellable("Phase Gate", 452_000_000_000_000_000_000_000_000_000_000, [(DEEP_SPACE_SCANNER, 100), (ADVANCED_TELEPORTER, 1_000), (ORBITAL_DOCK, 1)], time_to_make=699_000)
# NEURAL_MATRIX = Sellable("Neural Matrix", 452_000_000_000_000_000_000_000_000_000_000, [(ANTIMATTER_CELL, 4), (SOLAR_COLLECTOR, 1), (OSMIUM_BAR, 16_000)], time_to_make=699_000)

profits = []
for s in SELLABLES:
    if s.smelt_time > 0:
        profits.append((s.get_profit_per_second(), s.name))
profits.sort(reverse=True)
for p, s in profits:
    print(f"{p:.2f}\t{s}")

alloys = [s for s in SELLABLES[:ALLOYS_END] if s.smelt_time > 0]
items = [s for s in SELLABLES[ALLOYS_END:] if s.smelt_time > 0]

fig, axs = plt.subplots(2, 2, figsize=(16, 10))
for col, (label, group) in enumerate([("Alloy", alloys), ("Item", items)]):
    names = [s.name for s in group]
    values = [s.get_profit_per_second() for s in group]
    for row, yscale in enumerate(["linear", "log"]):
        ax = axs[row][col]
        ax.bar(names, values)
        ax.set_yscale(yscale)
        ax.set_xlabel(label)
        ax.set_ylabel("Profit per second ($)")
        ax.set_title(f"{label} Profit per Second ({yscale})")
        ax.tick_params(axis="x", rotation=45)
        for tick in ax.get_xticklabels():
            tick.set_ha("right")
plt.tight_layout()
plt.show()

