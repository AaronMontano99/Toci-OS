"""What each equipment setting can actually do, and what to do instead when it can't.

The three settings mean what onboarding tells the user they mean:
- full_gym:   "Barbells, machines, everything"
- home_gym:   "Dumbbells, bands, a bench" -- no barbell, rack, cable stack or pull-up bar
- bodyweight: "No equipment needed"

Each catalog exercise has the lowest setting it works with. When a user's setting
is below that, the engine swaps in an exercise for the same movement pattern, with
a starting load scaled to the new implement (a dumbbell bench press per hand is
well under half the barbell; bodyweight moves start at 0). Exercises not listed --
ones a user added themselves -- are assumed to fit: we don't know what they need,
and refusing someone's own exercise would be worse than trusting it.
"""

LEVELS = {"bodyweight": 0, "home_gym": 1, "full_gym": 2}

# exercise -> lowest setting it works with
NEEDS = {
    "Barbell Bench Press": "full_gym", "Overhead Press": "full_gym", "Landmine Press": "full_gym",
    "Face Pulls": "full_gym", "Triceps Pushdown": "full_gym", "Barbell Back Squat": "full_gym",
    "Leg Extension": "full_gym", "Romanian Deadlift": "full_gym", "Leg Curl": "full_gym",
    "Barbell Row": "full_gym", "T-Bar Row": "full_gym", "Seated Cable Row": "full_gym",
    "Lat Pulldown": "full_gym", "Pull-Up": "full_gym", "Dead Hang": "full_gym", "Hanging Knee Raise": "full_gym",
    "Neutral-Grip Dumbbell Press": "home_gym", "Incline Dumbbell Press": "home_gym", "Lateral Raise": "home_gym",
    "Rear-Delt Fly": "home_gym", "Hammer Curl": "home_gym", "Farmer's Carry": "home_gym",
    "Bulgarian Split Squat": "bodyweight", "Walking Lunge": "bodyweight", "Plank": "bodyweight",
}

# exercise -> {setting: (substitute, load factor vs the original, movement_pattern, primary_muscle_group)}
SWAPS = {
    "Barbell Bench Press": {"home_gym": ("Dumbbell Bench Press", 0.4, "horizontal_push", "chest"),
                            "bodyweight": ("Push-Up", 0, "horizontal_push", "chest")},
    "Incline Dumbbell Press": {"bodyweight": ("Feet-Elevated Push-Up", 0, "horizontal_push", "chest")},
    "Neutral-Grip Dumbbell Press": {"bodyweight": ("Push-Up", 0, "horizontal_push", "chest")},
    "Overhead Press": {"home_gym": ("Dumbbell Shoulder Press", 0.4, "vertical_push", "shoulders"),
                       "bodyweight": ("Pike Push-Up", 0, "vertical_push", "shoulders")},
    # landmine work usually stands in for a sore shoulder, so the home version stays off the overhead path
    "Landmine Press": {"home_gym": ("Neutral-Grip Dumbbell Press", 0.4, "vertical_push", "shoulders"),
                       "bodyweight": ("Push-Up", 0, "horizontal_push", "chest")},
    "Lateral Raise": {"bodyweight": ("Prone Y-T-W Raise", 0, "isolation", "shoulders")},
    "Face Pulls": {"home_gym": ("Band Face Pull", 0, "isolation", "shoulders"),
                   "bodyweight": ("Prone Y-T-W Raise", 0, "isolation", "shoulders")},
    "Rear-Delt Fly": {"bodyweight": ("Prone Y-T-W Raise", 0, "isolation", "shoulders")},
    "Triceps Pushdown": {"home_gym": ("Band Triceps Pushdown", 0, "isolation", "arms"),
                         "bodyweight": ("Bench Dip", 0, "isolation", "arms")},
    "Hammer Curl": {"bodyweight": ("Towel Isometric Curl", 0, "isolation", "arms")},
    "Barbell Back Squat": {"home_gym": ("Goblet Squat", 0.3, "squat", "quads"),
                           "bodyweight": ("Tempo Bodyweight Squat", 0, "squat", "quads")},
    "Leg Extension": {"home_gym": ("Dumbbell Step-Up", 0.15, "squat", "quads"),
                      "bodyweight": ("Step-Up", 0, "squat", "quads")},
    "Romanian Deadlift": {"home_gym": ("Dumbbell Romanian Deadlift", 0.35, "hinge", "hamstrings"),
                          "bodyweight": ("Single-Leg Hip Hinge", 0, "hinge", "hamstrings")},
    "Leg Curl": {"home_gym": ("Sliding Leg Curl", 0, "isolation", "hamstrings"),
                 "bodyweight": ("Sliding Leg Curl", 0, "isolation", "hamstrings")},
    "Barbell Row": {"home_gym": ("One-Arm Dumbbell Row", 0.4, "horizontal_pull", "back"),
                    "bodyweight": ("Doorframe Row", 0, "horizontal_pull", "back")},
    "T-Bar Row": {"home_gym": ("One-Arm Dumbbell Row", 0.4, "horizontal_pull", "back"),
                  "bodyweight": ("Doorframe Row", 0, "horizontal_pull", "back")},
    "Seated Cable Row": {"home_gym": ("Band Row", 0, "horizontal_pull", "back"),
                         "bodyweight": ("Doorframe Row", 0, "horizontal_pull", "back")},
    "Lat Pulldown": {"home_gym": ("Band Lat Pulldown", 0, "vertical_pull", "back"),
                     "bodyweight": ("Doorframe Row", 0, "horizontal_pull", "back")},
    "Pull-Up": {"home_gym": ("Band Lat Pulldown", 0, "vertical_pull", "back"),
                "bodyweight": ("Doorframe Row", 0, "horizontal_pull", "back")},
    "Dead Hang": {"home_gym": ("Dumbbell Farmer's Hold", 0, "isolation", "back"),
                  "bodyweight": ("Hollow Body Hold", 0, "core", "core")},
    "Hanging Knee Raise": {"home_gym": ("Lying Leg Raise", 0, "core", "core"),
                           "bodyweight": ("Lying Leg Raise", 0, "core", "core")},
    "Farmer's Carry": {"bodyweight": ("Bear Crawl", 0, "carry", "full_body")},
}

# Substitutes that themselves need gear: kept here so a swap is never worse than the original.
NEEDS.update({
    "Dumbbell Bench Press": "home_gym", "Dumbbell Shoulder Press": "home_gym", "Band Face Pull": "home_gym",
    "Band Triceps Pushdown": "home_gym", "Goblet Squat": "home_gym", "Dumbbell Step-Up": "home_gym",
    "Dumbbell Romanian Deadlift": "home_gym", "One-Arm Dumbbell Row": "home_gym", "Band Row": "home_gym",
    "Band Lat Pulldown": "home_gym", "Dumbbell Farmer's Hold": "home_gym",
})


def level(equipment: str | None) -> int:
    return LEVELS.get(equipment or "full_gym", LEVELS["full_gym"])


def fits(name: str, equipment: str | None) -> bool:
    return LEVELS[NEEDS.get(name, "bodyweight")] <= level(equipment)


def swap_for(name: str, equipment: str | None):
    """(substitute, load factor, pattern, muscle) for an exercise this setting can't do, else None."""
    if fits(name, equipment):
        return None
    swap = SWAPS.get(name, {}).get(equipment or "full_gym")
    return swap if swap and fits(swap[0], equipment) else None


def can_add_load(equipment: str | None) -> bool:
    """Bodyweight-only training progresses by reps: there's no weight to add."""
    return level(equipment) > LEVELS["bodyweight"]


def increment_kg(equipment: str | None) -> float:
    """The smallest jump the user's own weights allow. A barbell takes 2.5 kg (two small
    plates); adjustable home dumbbells step about 1 kg, and on a 25 kg dumbbell a 2.5 kg jump
    is a 10% leap that ends in missed reps."""
    return 1.0 if equipment == "home_gym" else 2.5
