# Trafalgar Junkyards Experiments

Private staging copy of the Trafalgar Junkyards POB Control dashboard.

Use this repository to prototype and review changes before carrying approved work into the live repository: [Bishopzehel/Nell-s-DIner](https://github.com/Bishopzehel/Nell-s-DIner), branch `Elcano-Work-v1`.

The baseline was copied from the live branch on 2026-10-30. The published dashboard remains at https://bishopzehel.github.io/Nell-s-DIner/.

Changes here are experimental. Do not treat them as published until they are deliberately transferred to the live repository.
## Trade route experiment

The Trade Routes tab compares each commodity in Trafalgar Junkyards' current inventory against quotes from other player-owned bases returned by Darkstat. It shows both directions: sell stock from Trafalgar to a base that pays more, or buy from another base and sell into Trafalgar. Prices are labeled by base perspective (BASE BUYS / BASE SELLS), margins are per unit before costs, and Freighter travel estimates are shown only when Darkstat returns them. Market values and base stock are live telemetry and can change.
