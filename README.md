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
- local persistence in browser `localStorage`

## Run It

Because this is a plain frontend app, you can open [index.html](/Users/deepakt/Desktop/claude-projects/meal-planner/index.html) directly in a browser.

Main pages:

- [Home](/Users/deepakt/Desktop/claude-projects/meal-planner/index.html)
- [Meal Plans](/Users/deepakt/Desktop/claude-projects/meal-planner/plans.html)
- [Recipes](/Users/deepakt/Desktop/claude-projects/meal-planner/recipes.html)
- [Weekly Planner](/Users/deepakt/Desktop/claude-projects/meal-planner/planner.html)
- [Shopping List](/Users/deepakt/Desktop/claude-projects/meal-planner/shopping-list.html)

If you prefer serving it locally:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Storage

This version stores data in the browser under:

```text
meal-planner-v1
```

If you want, the next step can be converting this into a MySQL-backed app with a Node/Express API.
