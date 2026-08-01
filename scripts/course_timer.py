"""Compte à rebours en ligne de commande, réglé sur cinq minutes par défaut."""

from __future__ import annotations

import argparse
import time

DEFAULT_DURATION_SECONDS = 5 * 60
SECONDS_PER_MINUTE = 60


def format_remaining_time(remaining_seconds: int) -> str:
    """Transforme un nombre de secondes en texte ``MM:SS``."""
    minutes, seconds = divmod(max(0, remaining_seconds), SECONDS_PER_MINUTE)
    return f"{minutes:02d}:{seconds:02d}"


def run_countdown(duration_seconds: int) -> None:
    """Affiche le temps restant chaque seconde en utilisant une horloge monotone."""
    if duration_seconds <= 0:
        raise ValueError("La durée doit être strictement positive.")

    deadline = time.monotonic() + duration_seconds
    while True:
        remaining_seconds = max(0, round(deadline - time.monotonic()))
        print(f"\rTemps restant : {format_remaining_time(remaining_seconds)}", end="", flush=True)
        if remaining_seconds == 0:
            break
        time.sleep(min(1.0, max(0.0, deadline - time.monotonic())))
    print("\nTemps écoulé.")


def parse_arguments() -> argparse.Namespace:
    """Lit l'option ``--seconds`` fournie dans le terminal."""
    parser = argparse.ArgumentParser(description="Lancer un compte à rebours.")
    parser.add_argument(
        "--seconds",
        type=int,
        default=DEFAULT_DURATION_SECONDS,
        help="Durée en secondes (300 par défaut, soit cinq minutes).",
    )
    return parser.parse_args()


def main() -> None:
    """Point d'entrée du script."""
    arguments = parse_arguments()
    try:
        run_countdown(arguments.seconds)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    except KeyboardInterrupt:
        print("\nTimer interrompu.")


if __name__ == "__main__":
    main()
