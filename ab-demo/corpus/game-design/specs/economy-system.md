---
type: feature-spec
domain: game-design
slug: economy-system
status: accepted
title: Economy System
tags:
  - economy
  - trade
related:
  - caravan
  - stamina
updated: 2026-06-24
---

## Overview

The economy ties every system in the game together. Gold is the only hard currency; reputation and supplies act as soft currencies that gate what gold can buy. The design goal is that no single trade route stays optimal for more than a few in-game weeks, so players keep rerouting their [[caravan]] instead of grinding one loop.

Three pressures shape every decision: upkeep drains gold every day, prices drift with supply and demand, and towns react to how the player treats them. Each pressure is tuned independently so designers can rebalance one without touching the others.

## Gold and income

Players earn gold from three sources: selling trade goods, completing contracts, and salvaging loot after combat (see [[combat-system]]). Trade goods are the dominant source after the first act; contracts are the dominant source before it.

Income is deliberately noisy. A single sale never pays the same twice because the base price is multiplied by a local demand factor and a daily volatility roll. Designers must never hard-code expected profit per route; use the simulation tool in the balance workbook instead.

Loot salvage is capped at 15 percent of a player's total weekly income. The cap exists to stop players farming trivial encounters instead of trading, and it is enforced by diminishing the salvage value of repeated enemy types within the same region.

## Upkeep

Every wagon in the caravan costs 12 gold per day in upkeep, charged at dawn. Upkeep covers feed, repairs and guard wages and is not itemised in the UI. Hired guards add 5 gold per day each. If the party cannot pay at dawn, the economy enters the debt state described below.

Upkeep scales linearly with wagon count on purpose. Doubling the caravan doubles the daily burn, which keeps very large caravans risky unless the player has secured premium routes. Stamina costs for pushing the caravan overland are handled separately; see [[stamina]].

Resting in a town with a stable halves wagon upkeep for that day. This is the main reason players return to friendly settlements rather than camping in the wilderness.

## Trade routes and prices

Each town has a demand table with up to eight goods. Prices move by plus or minus 15 percent per week around a regional base value, drifting toward the average as the player sells more of the same good. Selling ten units of one good in one visit drops the local price by 5 percent for the following week.

Routes between two towns carry a route tax of 8 percent of the sale value, collected by the nearer guild. The tax is waived at reputation tier Trusted or higher. Smuggled goods skip the tax but trigger a search check at every checkpoint on the route.

Price changes are computed at the world tick, not on player action, so waiting at a town does not reset a depressed price. Players see only the current price and a coarse trend arrow; exact volatility numbers are never shown.

## Reputation tiers

Each guild tracks reputation on a scale from minus 100 to 100, mapped to five tiers: Hostile, Wary, Neutral, Trusted and Honored. Tier thresholds are minus 50, minus 10, 10 and 60. Completing contracts raises reputation by 3 to 8 points depending on difficulty; abandoning a contract costs 10.

Tier effects: Wary guilds refuse premium contracts, Trusted guilds waive the route tax, and Honored guilds unlock the guild vault where rare wagon upgrades are sold. Hostile status closes the guild's towns to trade entirely until reputation is repaired through a restitution contract.

## Debt and bankruptcy

When the party cannot pay upkeep at dawn, it enters debt. Debt accrues 10 percent interest per in-game week and blocks purchases of anything except supplies. A party whose debt exceeds 500 gold is bankrupt: the guild repossesses the most expensive wagon and resets reputation with the creditor guild to Wary.

Bankruptcy is designed to be recoverable rather than a fail state. The repossession always leaves the player at least one wagon, and a one-time relief contract becomes available in the nearest neutral town.

## Open tuning questions

- Whether salvage income should scale with region danger instead of being capped globally.
- Whether the 8 percent route tax should vary by distance between the two towns.
- How aggressive the debt interest should be on easy difficulty.
