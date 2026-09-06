// Curated market list for the drill-down. Featured markets + a player-prop set
// per /sports `group`, ALL alternate markets excluded. Keys are from
// https://the-odds-api.com/sports-odds-data/betting-markets.html — enumerated
// here (see docs/sportsbook.md). Labels are derived, not hand-written.

export interface MarketDef {
  key: string;
  label: string;
}

const FEATURED_GAME_KEYS = ["h2h", "spreads", "totals"];
const FEATURED_OUTRIGHT_KEYS = ["outrights"];

// Player props keyed by the /sports `group` value.
const GROUP_PROP_KEYS: Record<string, string[]> = {
  "American Football": [
    "player_assists",
    "player_defensive_interceptions",
    "player_field_goals",
    "player_kicking_points",
    "player_pass_attempts",
    "player_pass_completions",
    "player_pass_interceptions",
    "player_pass_longest_completion",
    "player_pass_rush_yds",
    "player_pass_rush_reception_tds",
    "player_pass_rush_reception_yds",
    "player_pass_tds",
    "player_pass_yds",
    "player_pass_yds_q1",
    "player_pats",
    "player_receptions",
    "player_reception_longest",
    "player_reception_tds",
    "player_reception_yds",
    "player_rush_attempts",
    "player_rush_longest",
    "player_rush_reception_tds",
    "player_rush_reception_yds",
    "player_rush_tds",
    "player_rush_yds",
    "player_sacks",
    "player_solo_tackles",
    "player_tackles_assists",
    "player_tds_over",
    "player_1st_td",
    "player_anytime_td",
    "player_last_td",
  ],
  Basketball: [
    "player_points",
    "player_points_q1",
    "player_rebounds",
    "player_rebounds_q1",
    "player_assists",
    "player_assists_q1",
    "player_threes",
    "player_blocks",
    "player_steals",
    "player_blocks_steals",
    "player_turnovers",
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_points_assists",
    "player_rebounds_assists",
    "player_field_goals",
    "player_frees_made",
    "player_frees_attempts",
    "player_first_basket",
    "player_first_team_basket",
    "player_double_double",
    "player_triple_double",
    "player_method_of_first_basket",
    "player_fantasy_points",
  ],
  Baseball: [
    "batter_home_runs",
    "batter_first_home_run",
    "batter_hits",
    "batter_total_bases",
    "batter_rbis",
    "batter_runs_scored",
    "batter_hits_runs_rbis",
    "batter_singles",
    "batter_doubles",
    "batter_triples",
    "batter_walks",
    "batter_strikeouts",
    "batter_stolen_bases",
    "batter_fantasy_score",
    "pitcher_strikeouts",
    "pitcher_record_a_win",
    "pitcher_hits_allowed",
    "pitcher_walks",
    "pitcher_earned_runs",
    "pitcher_outs",
  ],
  "Ice Hockey": [
    "player_points",
    "player_power_play_points",
    "player_assists",
    "player_blocked_shots",
    "player_shots_on_goal",
    "player_goals",
    "player_total_saves",
    "player_goal_scorer_first",
    "player_goal_scorer_last",
    "player_goal_scorer_anytime",
  ],
  Soccer: [
    "player_goal_scorer_anytime",
    "player_first_goal_scorer",
    "player_last_goal_scorer",
    "player_to_receive_card",
    "player_to_receive_red_card",
    "player_shots_on_target",
    "player_shots",
    "player_assists",
  ],
};

const ABBR: Record<string, string> = {
  td: "TD",
  tds: "TDs",
  yds: "Yards",
  rbis: "RBIs",
  pat: "PAT",
  pats: "PATs",
  q1: "1Q",
  h1: "1H",
  ppp: "PPP",
  "1st": "1st",
};

/** "player_pass_yds" -> "Pass Yards (player)"; featured keys get plain names. */
export function marketLabel(key: string): string {
  switch (key) {
    case "h2h":
      return "Moneyline (h2h)";
    case "spreads":
      return "Spread";
    case "totals":
      return "Total (over/under)";
    case "outrights":
      return "Outright / futures";
  }
  let role = "";
  let rest = key;
  for (const p of ["player_", "batter_", "pitcher_"]) {
    if (rest.startsWith(p)) {
      role = p.slice(0, -1);
      rest = rest.slice(p.length);
      break;
    }
  }
  const words = rest
    .split("_")
    .map((w) => ABBR[w] ?? w.charAt(0).toUpperCase() + w.slice(1));
  const label = words.join(" ");
  return role ? `${label} (${role})` : label;
}

function defs(keys: string[]): MarketDef[] {
  return keys.map((key) => ({ key, label: marketLabel(key) }));
}

/** Candidate markets for a sport: featured for its flow, plus props for its
 *  group. Candidates only — the event-odds call validates them on selection. */
export function marketsForSport(
  group: string,
  hasOutrights: boolean,
): MarketDef[] {
  if (hasOutrights) return defs(FEATURED_OUTRIGHT_KEYS);
  return defs([...FEATURED_GAME_KEYS, ...(GROUP_PROP_KEYS[group] ?? [])]);
}
