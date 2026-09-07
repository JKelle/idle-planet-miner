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

    def _get_project_bonus(self) -> float:
        raise NotImplementedError()

    def _get_station_bonus(self) -> float:
        raise NotImplementedError()

    def _get_sales_room_bonus(self) -> float:
        raise NotImplementedError()

    def _get_market_boost(self) -> float:
        return MARKET_BOOSTS.get(self.name, 1.0)

    def get_sell_price(self) -> float:
        # Each star adds 20% to the sell price
        star_bonus = (1 + 0.2 * self.stars)
        return (
            self.base_sell_price *
            self._get_market_boost() *
            star_bonus *
            self._get_project_bonus() *
            self._get_station_bonus() *
            self._get_sales_room_bonus()
        )

    def get_total_time_to_create(self):
        time_to_create_ingredients = 0
        for child, amount in self.ingredients:
            time_to_create_ingredients += child.get_total_time_to_create() * amount
        return time_to_create_ingredients + self.smelt_time

    def get_net_ingredient_material_cost(self):
        # Only count the raw ore cost (recursively) because adding the value of the alloy/item ingredients
        # cancels out when we subtract it to consume it for upstream alloys/items.
        ingredient_material_cost = 0
        for child, amount in self.ingredients:
            if isinstance(child, Ore):
                ingredient_material_cost += child.get_sell_price() * amount
            else:
                ingredient_material_cost += child.get_net_ingredient_material_cost() * amount
        return ingredient_material_cost

    def get_profit_per_second(self):
        """Returns units of dollars per second"""
        profit = self.get_sell_price() - self.get_net_ingredient_material_cost()
        return profit / self.get_total_time_to_create()


class Ore(Sellable):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        ORES.append(self)

    def _get_project_bonus(self) -> float:
        return 1.0

    def _get_station_bonus(self) -> float:
        return 1.0

    def _get_sales_room_bonus(self) -> float:
        return 1.0

class Alloy(Sellable):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        ALLOYS.append(self)

    def _get_project_bonus(self) -> float:
        return 1.44

    def _get_station_bonus(self) -> float:
        return 1.04

    def _get_sales_room_bonus(self) -> float:
        return 1.45


class Item(Sellable):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        ITEMS.append(self)

    def _get_project_bonus(self) -> float:
        return 1.20

    def _get_station_bonus(self) -> float:
        return 1.04

    def _get_sales_room_bonus(self) -> float:
        return 1.45


ORES: list[Ore] = []
ALLOYS: list[Alloy] = []
ITEMS: list[Item] = []

########
# Ores #
########
COPPER = Ore("Copper Ore", 1, stars=2)
IRON = Ore("Iron Ore", 2, stars=5)
LEAD = Ore("Lead Ore", 4, stars=2)
SILICON = Ore("Silicon Ore", 8, stars=2)
ALUMINUM = Ore("Aluminum Ore", 17, stars=4)
SILVER = Ore("Silver Ore", 36, stars=1)
GOLD = Ore("Gold Ore", 75, stars=3)
DIAMOND = Ore("Diamond Ore", 160, stars=2)
PLATINUM = Ore("Platinum Ore", 340, stars=7)
TITANIUM = Ore("Titanium Ore", 730, stars=4)
IRIDIUM = Ore("Iridium Ore", 1_600, stars=3)
PALLADIUM = Ore("Palladium Ore", 3_500, stars=5)
OSMIUM = Ore("Osmium Ore", 7_800, stars=1)
RHODIUM = Ore("Rhodium", 17_500, stars=0)
INERTON = Ore("Inerton", 40_000, stars=0)
# QUADIUM = Ore("Quadium", 92_000)
# SCRITH = Ore("Scrith", 215_000)
# URU = Ore("Uru", 510_000)
# VIBRANIUM = Ore("Vibranium", 1_250_000)
# AETHER = Ore("Aether", 3_200_000)
# VITERIUM = Ore("Viterium", 9_000_000)
# XYNIUM = Ore("Xynium", 28_000_000)
# QUOLIUM = Ore("Quolium", 90_000_000)
# LUTERIUM = Ore("Luterium", 300_000_000)
# WRAITH = Ore("Wraith", 1_100_000_000)
# AQUALITE = Ore("Aqualite", 4_300_000_000)
# OPALITE = Ore("Opalite", 18_000_000_000)

##########
# ALLOYS #
##########
COPPER_BAR = Alloy("Copper Bar", 1_450, [(COPPER, 560)], smelt_time=5, stars=0)
IRON_BAR = Alloy("Iron Bar", 3_000, [(IRON, 560)], smelt_time=8, stars=6)
LEAD_BAR = Alloy("Lead Bar", 6_100, [(LEAD, 560)], smelt_time=11, stars=5)
SILICON_BAR = Alloy("Silicon Bar", 12_500, [(SILICON, 560)], smelt_time=17, stars=4)
ALUMINUM_BAR = Alloy("Aluminum Bar", 27_600, [(ALUMINUM, 560)], smelt_time=23, stars=2)
SILVER_BAR = Alloy("Silver Bar", 60_000, [(SILVER, 560)], smelt_time=35, stars=4)
GOLD_BAR = Alloy("Gold Bar", 120_000, [(GOLD, 560)], smelt_time=52, stars=7)
BRONZE_BAR = Alloy("Bronze Bar", 234_000, [(SILVER_BAR, 1), (COPPER_BAR, 6)], smelt_time=60+10, stars=1)
STEEL_BAR = Alloy("Steel Bar", 340_000, [(LEAD_BAR, 8), (IRON_BAR, 17)], smelt_time=2*60+20, stars=2)
PLATINUM_BAR = Alloy("Platinum Bar", 780_000, [(GOLD_BAR, 1), (PLATINUM, 560)], smelt_time=2*60+55, stars=4)
TITANIUM_BAR = Alloy("Titanium Bar", 1_630_000, [(BRONZE_BAR, 1), (TITANIUM, 560)], smelt_time=3*60+30, stars=6)
IRIDIUM_BAR = Alloy("Iridium Bar", 3_110_000, [(STEEL_BAR, 1), (IRIDIUM, 560)], smelt_time=4*60+5, stars=1)
PALLADIUM_BAR = Alloy("Palladium Bar", 7_000_000, [(PLATINUM_BAR, 1), (PALLADIUM, 560)], smelt_time=4*60+40, stars=1)
OSMIUM_BAR = Alloy("Osmium Bar", 14_500_000, [(TITANIUM_BAR, 1), (OSMIUM, 560)], smelt_time=5*60+15, stars=4)
RHODIUM_BAR = Alloy("Rhodium Bar", 31_000_000, [(IRIDIUM_BAR, 1), (RHODIUM, 560)], smelt_time=5*60+50, stars=2)
INERTON_ALLOY = Alloy("Inerton Alloy", 68_000_000, [(PALLADIUM_BAR, 1), (INERTON, 560)], smelt_time=7*60, stars=2)
# QUADIUM_ALLOY = Alloy("Quadium Alloy", 152_000_000, [(OSMIUM_BAR, 2), (QUADIUM, 1_000)], smelt_time=1_680)
# SCRITH_ALLOY = Alloy("Scrith Alloy", 352_000_000, [(RHODIUM_BAR, 2), (SCRITH, 1_000)], smelt_time=1_920)
# URU_ALLOY = Alloy("Uru Alloy", 832_000_000, [(INERTON_ALLOY, 2), (URU, 1_000)], smelt_time=2_160)
# VIBRANIUM_ALLOY = Alloy("Vibranium Alloy", 2_050_000_000, [(QUADIUM_ALLOY, 2), (VIBRANIUM, 1_000)], smelt_time=2_400)
# AETHER_ALLOY = Alloy("Aether Alloy", 5_120_000_000, [(SCRITH_ALLOY, 2), (AETHER, 1_000)], smelt_time=2_640)
# VITERIUM_ALLOY = Alloy("Viterium Alloy", 15_500_000_000, [(URU_ALLOY, 2), (VITERIUM, 1_000)], smelt_time=2_880)
# XYNIUM_ALLOY = Alloy("Xynium Alloy", 48_000_000_000, [(VIBRANIUM_ALLOY, 5), (XYNIUM, 1_500)], smelt_time=3_300)
# QUOLIUM_ALLOY = Alloy("Quolium Alloy", 160_000_000_000, [(AETHER_ALLOY, 5), (QUOLIUM, 1_500)], smelt_time=3_720)
# LUTERIUM_ALLOY = Alloy("Luterium Alloy", 600_000_000_000, [(VITERIUM_ALLOY, 5), (LUTERIUM, 1_500)], smelt_time=4_140)
# WRAITH_ALLOY = Alloy("Wraith Alloy", 2_400_000_000_000, [(XYNIUM_ALLOY, 5), (WRAITH, 1_500)], smelt_time=4_560)
# AQUALITE_ALLOY = Alloy("Aqualite Alloy", 17_500_000_000_000, [(QUOLIUM_ALLOY, 5), (AQUALITE, 1_500)], smelt_time=4_980)
# OPALITE_ALLOY = Alloy("Opalite Alloy", 277_000_000_000_000, [(WRAITH_ALLOY, 5), (OPALITE, 1_500)], smelt_time=5_520)

#########
# ITEMS #
#########
COPPER_WIRE = Item("Copper Wire", 10_000, [(COPPER_BAR, 2)], smelt_time=14, stars=2)
IRON_NAILS = Item("Iron Nails", 20_000, [(IRON_BAR, 2)], smelt_time=29, stars=3)
BATTERY = Item("Battery", 70_000, [(COPPER_WIRE, 1), (COPPER_BAR, 4)], smelt_time=58, stars=1)
HAMMER = Item("Hammer", 135_000, [(IRON_NAILS, 1), (LEAD_BAR, 2)], smelt_time=1*60 + 56, stars=3)
GLASS = Item("Glass", 220_000, [(SILICON_BAR, 4)], smelt_time=2*60+55, stars=5)
CIRCUIT = Item("Circuit", 620_000, [(SILICON_BAR, 2), (ALUMINUM_BAR, 2), (COPPER_WIRE, 4)], smelt_time=4*60+52, stars=1)
LENS = Item("Lens", 1_100_000, [(GLASS, 1), (SILVER_BAR, 2)], smelt_time=9*60+44, stars=4)
LASER = Item("Laser", 3_200_000, [(GOLD_BAR, 2), (LENS, 1), (IRON_BAR, 4)], smelt_time=14*60+37, stars=3)
BASIC_COMPUTER = Item("Basic Computer", 7_600_000, [(CIRCUIT, 2), (SILVER_BAR, 2)], smelt_time=19*60+29, stars=3)
SOLAR_PANEL = Item("Solar Panel", 12_500_000, [(CIRCUIT, 2), (GLASS, 4)], smelt_time=24*60+22, stars=2)
LASER_TORCH = Item("Laser Torch", 31_000_000, [(BRONZE_BAR, 2), (LASER, 1), (LENS, 2)], smelt_time=29*60+14, stars=3)
ADVANCED_BATTERY = Item("Advanced Battery", 35_000_000, [(STEEL_BAR, 9), (BATTERY, 13)], smelt_time=36*60+33, stars=3)
THERMAL_SCANNER = Item("Thermal Scanner", 71_500_000, [(PLATINUM_BAR, 2), (LASER, 1), (GLASS, 2)], smelt_time=43*60+51, stars=2)
ADVANCED_COMPUTER = Item("Advanced Computer", 180_000_000, [(TITANIUM_BAR, 2), (BASIC_COMPUTER, 2)], smelt_time=51*60+10, stars=1)
NAVIGATION_MODULE = Item("Navigation Module", 1_000_000_000, [(THERMAL_SCANNER, 1), (LASER_TORCH, 1)], smelt_time=54*60+49, stars=2)
PLASMA_TORCH = Item("Plasma Torch", 1_150_000_000, [(IRIDIUM_BAR, 6), (LASER_TORCH, 2)], smelt_time=60*60, stars=0)
RADIO_TOWER = Item("Radio Tower", 1_450_000_000, [(PLATINUM_BAR, 32), (ALUMINUM_BAR, 65), (TITANIUM_BAR, 22)], smelt_time=60*60+3*60, stars=0)
TELESCOPE = Item("Telescope", 2_700_000_000, [(LENS, 9), (ADVANCED_COMPUTER, 1)], smelt_time=60*60 + 7*60, stars=1)
SATELLITE_DISH = Item("Satellite Dish", 3_400_000_000, [(STEEL_BAR, 65), (PALLADIUM_BAR, 13)], smelt_time=60*60 + 12*60, stars=0)
MOTOR = Item("Motor", 7_000_000_000, [(BRONZE_BAR, 216), (HAMMER, 86)], smelt_time=60*60 + 17*60, stars=0)
# ACCUMULATOR = Item("Accumulator", 12_000_000_000, [(OSMIUM_BAR, 20), (ADVANCED_BATTERY, 3)], smelt_time=20_400)
# NUCLEAR_CAPSULE = Item("Nuclear Capsule", 26_000_000_000, [(RHODIUM_BAR, 5), (PLASMA_TORCH, 1)], smelt_time=21_000)
# WIND_TURBINE = Item("Wind Turbine", 140_000_000_000, [(ALUMINUM_BAR, 300), (MOTOR, 1)], smelt_time=21_600)
# SPACE_PROBE = Item("Space Probe", 180_000_000_000, [(SATELLITE_DISH, 1), (TELESCOPE, 1), (SOLAR_PANEL, 25)], smelt_time=22_200)
# NUCLEAR_REACTOR = Item("Nuclear Reactor", 1_000_000_000_000, [(NUCLEAR_CAPSULE, 1), (IRIDIUM_BAR, 300)], smelt_time=22_800)
# COLLIDER = Item("Collider", 2_000_000_000_000, [(INERTON_ALLOY, 500), (QUADIUM_ALLOY, 100)], time_to_make=23_100)
# GRAVITY_CHAMBER = Item("Gravity Chamber", 15_000_000_000_000, [(ADVANCED_COMPUTER, 60), (NUCLEAR_REACTOR, 1)], time_to_make=24_300)
# ROBOT = Item("Robot", 50_000_000_000_000, [(SCRITH_ALLOY, 300), (ACCUMULATOR, 90)], time_to_make=26_000)
# FUSION_CAPSULE = Item("Fusion Capsule", 240_000_000_000_000, [(URU_ALLOY, 200), (VIBRANIUM_ALLOY, 100), (NUCLEAR_CAPSULE, 100)], time_to_make=27_000)
# TELEPORTER = Item("Teleporter", 1_800_000_000_000_000, [(NAVIGATION_MODULE, 250), (GRAVITY_CHAMBER, 1)], time_to_make=29_000)
# FUSION_REACTOR = Item("Fusion Reactor", 40_000_000_000_000_000, [(FUSION_CAPSULE, 1), (COLLIDER, 40), (NUCLEAR_REACTOR, 50)], time_to_make=31_000)
# SUBSPACE_RELAY = Item("Subspace Relay", 1_000_000_000_000_000_000, [(SPACE_PROBE, 70), (SATELLITE_DISH, 100), (TELEPORTER, 1)], time_to_make=32_300)
# ADVANCED_ROBOT = Item("Advanced Robot", 29_500_000_000_000_000_000, [(ROBOT, 100), (FUSION_REACTOR, 5)], time_to_make=62_300)
# ADVANCED_TELEPORTER = Item("Advanced Teleporter", 650_000_000_000_000_000_000, [(SUBSPACE_RELAY, 5), (TELEPORTER, 100), (XYNIUM_ALLOY, 1_000)], time_to_make=115_200)
# QUANTUM_CPU = Item("Quantum CPU", 14_000_000_000_000_000_000_000, [(ADVANCED_ROBOT, 4), (QUOLIUM_ALLOY, 500)], time_to_make=120_000)
# DEFLECTOR_SHIELD = Item("Deflector Shield", 320_000_000_000_000_000_000_000, [(ADVANCED_TELEPORTER, 4), (LUTERIUM_ALLOY, 400)], time_to_make=125_000)
# WARP_CORE = Item("Warp Core", 6_800_000_000_000_000_000_000_000, [(WIND_TURBINE, 160), (FUSION_REACTOR, 40), (QUANTUM_CPU, 4)], time_to_make=180_000)
# DEEP_SPACE_SCANNER = Item("Deep Space Scanner", 145_000_000_000_000_000_000_000_000, [(ADVANCED_BATTERY, 250), (AQUALITE_ALLOY, 1_000), (DEFLECTOR_SHIELD, 4)], time_to_make=188_000)
# ANTIMATTER_CELL = Item("Antimatter Cell", 3_200_000_000_000_000_000_000_000_000, [(NUCLEAR_REACTOR, 50), (PALLADIUM_BAR, 10_000), (WARP_CORE, 4)], time_to_make=194_000)
# ATMOSPHERIC_PROCESSOR = Item("Atmospheric Processor", 68_000_000_000_000_000_000_000_000_000, [(IRIDIUM_BAR, 10_000), (DEEP_SPACE_SCANNER, 4), (QUANTUM_CPU, 15)], time_to_make=244_000)
# ORBITAL_DOCK = Item("Orbital Dock", 2_800_000_000_000_000_000_000_000_000_000, [(WRAITH_ALLOY, 6_000), (ANTIMATTER_CELL, 4), (WARP_CORE, 10)], time_to_make=399_000)
# SOLAR_COLLECTOR = Item("Solar Collector", 2_800_000_000_000_000_000_000_000_000_000, [(SOLAR_PANEL, 1_000), (DEFLECTOR_SHIELD, 20), (DEEP_SPACE_SCANNER, 132)], time_to_make=399_000)
# PHASE_GATE = Item("Phase Gate", 452_000_000_000_000_000_000_000_000_000_000, [(DEEP_SPACE_SCANNER, 100), (ADVANCED_TELEPORTER, 1_000), (ORBITAL_DOCK, 1)], time_to_make=699_000)
# NEURAL_MATRIX = Item("Neural Matrix", 452_000_000_000_000_000_000_000_000_000_000, [(ANTIMATTER_CELL, 4), (SOLAR_COLLECTOR, 1), (OSMIUM_BAR, 16_000)], time_to_make=699_000)

MARKET_BOOSTS = {
    PALLADIUM.name: 2.0,
    # INERTON.name: 3.0,
}


profits = []
for s in ALLOYS + ITEMS:
    profits.append((s.get_profit_per_second(), s.name))
profits.sort(reverse=True)
for p, s in profits:
    print(f"{p:.2f}\t{s}")

def format_money_per_sec(value: float) -> str:
    """Formats a $/s value with a K/M/B/T suffix, rounded to 3 sig figs."""
    sign = "-" if value < 0 else ""
    abs_value = abs(value)
    for threshold, suffix in [(1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")]:
        if abs_value >= threshold:
            return f"{sign}${abs_value / threshold:.3g}{suffix}/s"
    return f"{sign}${abs_value:.3g}/s"


fig, axs = plt.subplots(2, 2, figsize=(16, 10))
for col, (label, group) in enumerate([("Alloy", ALLOYS), ("Item", ITEMS)]):
    names = [s.name for s in group]
    values = [s.get_profit_per_second() for s in group]
    for row, yscale in enumerate(["linear", "log"]):
        ax = axs[row][col]
        bars = ax.bar(names, values)
        ax.bar_label(bars, labels=[format_money_per_sec(v) for v in values], fontsize=7)
        ax.set_yscale(yscale)
        ax.set_xlabel(label)
        ax.set_ylabel("Profit per second ($)")
        ax.set_title(f"{label} Profit per Second ({yscale})")
        ax.tick_params(axis="x", rotation=45)
        for tick in ax.get_xticklabels():
            tick.set_ha("right")
plt.tight_layout()

combined = sorted(ALLOYS + ITEMS, key=lambda s: s.get_profit_per_second(), reverse=True)
combined_names = [s.name for s in combined]
combined_values = [s.get_profit_per_second() for s in combined]

fig2, axs2 = plt.subplots(2, 1, figsize=(16, 10))
for ax, yscale in zip(axs2, ["linear", "log"]):
    bars = ax.bar(combined_names, combined_values)
    ax.bar_label(bars, labels=[format_money_per_sec(v) for v in combined_values], fontsize=7)
    ax.set_yscale(yscale)
    ax.set_xlabel("Sellable")
    ax.set_ylabel("Profit per second ($)")
    ax.set_title(f"Alloy & Item Profit per Second ({yscale})")
    ax.tick_params(axis="x", rotation=45)
    for tick in ax.get_xticklabels():
        tick.set_ha("right")
plt.tight_layout()

plt.show()

