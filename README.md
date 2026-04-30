# Meal Planner

A browser-based weekly meal planner with:

- multiple meal plans for future weeks
- Monday through Sunday calendar layout
- separate pages for plans, recipes, weekly scheduling, and shopping lists
- reusable recipe library
- add saved recipes directly to a day
- create a brand new recipe while planning
- drag and drop meals between days
- shopping list generation for the selected week
- Supabase-backed persistence for plans, recipes, meals, and shopping list overrides
- database-backed recipe ingredient extraction for shopping lists

## Run It

Because this is a plain frontend app, you can open [index.html](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/index.html) directly in a browser.

Main pages:

- [Home](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/index.html)
- [Meal Plans](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/plans.html)
- [Recipes](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/recipes.html)
- [Weekly Planner](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/planner.html)
- [Shopping List](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/shopping-list.html)

If you prefer serving it locally:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Supabase Setup

1. Open the Supabase SQL editor for your project.
2. Run [sql/supabase-meal-planner.sql](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/sql/supabase-meal-planner.sql).
3. Open the app. Existing browser data from `meal-planner-v1` will be copied into Supabase on first load if the database is empty.

The browser client is configured in `supabase-config.js`, which is intentionally ignored by git. Use [supabase-config.example.js](/Users/deepakt/Desktop/claude-projects/meal-planner-db-connectivity/supabase-config.example.js) as the public template.

This setup is a single shared planner with public read/write policies so it can run as a static app with a publishable key. Add Supabase Auth and user-scoped policies before using it for private multi-user data.

## Local Cache

The app keeps a browser cache under:

```text
meal-planner-v1
```
