const STORAGE_KEY = "meal-planner-v1";
const SIDEBAR_STORAGE_KEY = "meal-planner-sidebar-collapsed";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];
const PAGE = document.body.dataset.page;

const seedRecipes = [
  {
    id: crypto.randomUUID(),
    name: "Sheet Pan Chicken Fajitas",
    ingredients: [
      { quantity: "2", name: "chicken breasts" },
      { quantity: "3", name: "bell peppers" },
      { quantity: "1", name: "onion" },
      { quantity: "1", name: "fajita seasoning packet" },
      { quantity: "8", name: "tortillas" },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Pasta Primavera",
    ingredients: [
      { quantity: "1 box", name: "pasta" },
      { quantity: "2", name: "zucchini" },
      { quantity: "1 pint", name: "cherry tomatoes" },
      { quantity: "1", name: "garlic bulb" },
      { quantity: "1 jar", name: "parmesan" },
    ],
  },
];

const els = {
  planList: document.getElementById("plan-list"),
  recipeList: document.getElementById("recipe-list"),
  weekGrid: document.getElementById("week-grid"),
  shoppingList: document.getElementById("shopping-list"),
  shoppingItemForm: document.getElementById("shopping-item-form"),
  shoppingItemQuantity: document.getElementById("shopping-item-quantity"),
  shoppingItemInput: document.getElementById("shopping-item-input"),
  currentPlanTitle: document.getElementById("current-plan-title"),
  currentPlanDate: document.getElementById("current-plan-date"),
  printPlanBtn: document.getElementById("print-plan-btn"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebarReopen: document.getElementById("sidebar-reopen"),
  planForm: document.getElementById("plan-form"),
  planName: document.getElementById("plan-name"),
  planDate: document.getElementById("plan-date"),
  recipeForm: document.getElementById("recipe-form"),
  recipeName: document.getElementById("recipe-name"),
  recipeIngredientsList: document.getElementById("recipe-ingredients-list"),
  addRecipeIngredient: document.getElementById("add-recipe-ingredient"),
  mealForm: document.getElementById("meal-form"),
  mealDay: document.getElementById("meal-day"),
  mealType: document.getElementById("meal-type"),
  mealRecipeSelect: document.getElementById("meal-recipe-select"),
  addToDayBtn: document.getElementById("add-to-day-btn"),
  customRecipePanel: document.getElementById("custom-recipe-panel"),
  quickRecipeForm: document.getElementById("quick-recipe-form"),
  quickRecipeName: document.getElementById("quick-recipe-name"),
  quickRecipeSaveToLibrary: document.getElementById("quick-recipe-save-to-library"),
  quickRecipeIngredientsList: document.getElementById("quick-recipe-ingredients-list"),
  addQuickIngredient: document.getElementById("add-quick-ingredient"),
  mealCardTemplate: document.getElementById("meal-card-template"),
};

let state = loadState();
let dragContext = null;
let editingRecipeId = null;

boot();

function boot() {
  hydrateSidebarState();
  setActiveNav();
  hydrateDaySelects();
  hydrateIngredientBuilders();
  if (els.planDate) {
    els.planDate.value = getMondayDateInputValue(new Date());
  }
  bindEvents();
  ensureActivePlan();
  render();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    const parsed = JSON.parse(saved);
    parsed.recipes = (parsed.recipes || []).map((recipe) => ({
      ...recipe,
      ingredients: (recipe.ingredients || []).map((ingredient) => normalizeIngredient(ingredient)),
    }));
    parsed.plans = (parsed.plans || []).map((plan) => ({
      ...plan,
      shoppingOverrides: (plan.shoppingOverrides || []).map((item) => ({
        removed: false,
        ...item,
      })),
    }));
    return parsed;
  }

  const starterPlan = createPlan({
    name: "This Week",
    weekStart: getMondayDateInputValue(new Date()),
  });

  return {
    recipes: seedRecipes,
    plans: [starterPlan],
    activePlanId: starterPlan.id,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  if (els.sidebarToggle) {
    els.sidebarToggle.addEventListener("click", () => {
      setSidebarCollapsed(true);
    });
  }

  if (els.sidebarReopen) {
    els.sidebarReopen.addEventListener("click", () => {
      setSidebarCollapsed(false);
    });
  }

  if (els.planForm) {
    els.planForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const plan = createPlan({
        name: els.planName.value.trim(),
        weekStart: els.planDate.value,
      });

      state.plans.unshift(plan);
      state.activePlanId = plan.id;
      persistAndRender();
      els.planForm.reset();
      els.planDate.value = getMondayDateInputValue(new Date());
    });
  }

  if (els.recipeForm) {
    els.recipeForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const recipe = buildRecipeFromForm(els.recipeName, els.recipeIngredientsList);
      if (!recipe) {
        return;
      }

      state.recipes.unshift(recipe);
      persistAndRender();
      els.recipeForm.reset();
      resetIngredientRows(els.recipeIngredientsList);
    });
  }

  if (els.mealForm) {
    els.mealForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const activePlan = getActivePlan();
      if (!activePlan || !els.mealRecipeSelect.value || els.mealRecipeSelect.value === "__custom__") {
        return;
      }

      activePlan.meals.push({
        id: crypto.randomUUID(),
        recipeId: els.mealRecipeSelect.value,
        day: els.mealDay.value,
        mealType: els.mealType.value,
      });

      persistAndRender();
    });
  }

  if (els.mealRecipeSelect) {
    els.mealRecipeSelect.addEventListener("change", () => {
      syncCustomRecipePanel();
    });
  }

  if (els.mealDay) {
    els.mealDay.addEventListener("change", () => {
      syncCustomRecipePanel();
    });
  }

  if (els.mealType) {
    els.mealType.addEventListener("change", () => {
      syncCustomRecipePanel();
    });
  }

  if (els.quickRecipeForm) {
    els.quickRecipeForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const recipe = buildRecipeFromForm(els.quickRecipeName, els.quickRecipeIngredientsList);
      if (!recipe) {
        return;
      }

      const activePlan = getActivePlan();
      if (!activePlan) {
        return;
      }

      if (els.quickRecipeSaveToLibrary.checked) {
        state.recipes.unshift(recipe);
        activePlan.meals.push({
          id: crypto.randomUUID(),
          recipeId: recipe.id,
          day: els.mealDay.value,
          mealType: els.mealType.value,
        });
      } else {
        activePlan.meals.push({
          id: crypto.randomUUID(),
          day: els.mealDay.value,
          mealType: els.mealType.value,
          recipeSnapshot: recipe,
        });
      }

      persistAndRender();
      els.quickRecipeForm.reset();
      els.quickRecipeSaveToLibrary.checked = true;
      resetIngredientRows(els.quickRecipeIngredientsList);
    });
  }

  if (els.shoppingItemForm) {
    els.shoppingItemForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const activePlan = getActivePlan();
      const label = els.shoppingItemInput.value.trim();
      const quantity = els.shoppingItemQuantity.value.trim();
      if (!activePlan || !label) {
        return;
      }

      activePlan.shoppingOverrides = activePlan.shoppingOverrides || [];
      activePlan.shoppingOverrides.push({
        id: crypto.randomUUID(),
        label,
        quantity,
        checked: false,
        source: "Manual",
        sourceKey: null,
        updated: false,
      });

      persistAndRender();
      els.shoppingItemForm.reset();
    });
  }

  if (els.printPlanBtn) {
    els.printPlanBtn.addEventListener("click", () => {
      window.print();
    });
  }
}

function createPlan({ name, weekStart }) {
  return {
    id: crypto.randomUUID(),
    name,
    weekStart,
    meals: [],
    shoppingOverrides: [],
  };
}

function createRecipe({ name, ingredients }) {
  return {
    id: crypto.randomUUID(),
    name,
    ingredients,
  };
}

function ensureActivePlan() {
  if (!state.plans.length) {
    const fallbackPlan = createPlan({
      name: "This Week",
      weekStart: getMondayDateInputValue(new Date()),
    });

    state.plans.push(fallbackPlan);
    state.activePlanId = fallbackPlan.id;
  }

  if (!state.plans.some((plan) => plan.id === state.activePlanId)) {
    state.activePlanId = state.plans[0].id;
  }
}

function persistAndRender() {
  saveState();
  render();
}

function render() {
  ensureActivePlan();
  renderPlanHeader();

  if (PAGE === "plans") {
    renderPlans();
  }

  if (PAGE === "recipes") {
    renderRecipes();
  }

  if (PAGE === "planner") {
    renderRecipeSelect();
    renderWeek();
  }

  if (PAGE === "shopping") {
    renderShoppingList();
  }
}

function renderPlans() {
  els.planList.innerHTML = "";

  state.plans
    .slice()
    .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
    .forEach((plan) => {
      const item = document.createElement("article");
      item.className = `plan-item ${plan.id === state.activePlanId ? "active" : ""}`;

      item.innerHTML = `
        <div class="plan-item-header">
          <button type="button" class="plan-select-btn">
            <strong>${escapeHtml(plan.name)}</strong>
            <div class="muted">${formatPlanRange(plan.weekStart)}</div>
          </button>
          <div class="plan-actions">
            <button type="button" class="ghost-btn plan-open-btn">Open Week</button>
            <button type="button" class="ghost-btn plan-shopping-btn">Shopping List</button>
            <button type="button" class="delete-chip plan-delete-btn">Delete</button>
          </div>
        </div>
      `;

      item.querySelector(".plan-select-btn").addEventListener("click", () => {
        state.activePlanId = plan.id;
        persistAndRender();
      });

      item.querySelector(".plan-open-btn").addEventListener("click", () => {
        state.activePlanId = plan.id;
        saveState();
        window.location.href = "./planner.html";
      });

      item.querySelector(".plan-shopping-btn").addEventListener("click", () => {
        state.activePlanId = plan.id;
        saveState();
        window.location.href = "./shopping-list.html";
      });

      item.querySelector(".plan-delete-btn").addEventListener("click", () => {
        removePlan(plan.id);
      });

      els.planList.appendChild(item);
    });
}

function renderRecipes() {
  els.recipeList.innerHTML = "";

  state.recipes.forEach((recipe) => {
    const item = document.createElement("article");
    item.className = "recipe-item";

    if (editingRecipeId === recipe.id) {
      item.innerHTML = `
        <div class="recipe-item-header">
            <strong>Edit Recipe</strong>
            <div class="recipe-actions">
              <button class="ghost-btn recipe-cancel-btn" type="button">Cancel</button>
              <button class="recipe-remove-btn recipe-delete-btn" type="button" aria-label="Delete recipe">&times;</button>
            </div>
          </div>
        <form class="recipe-edit-form">
          <label>
            Recipe name
            <input class="recipe-edit-name" type="text" value="${escapeAttribute(recipe.name)}" required />
          </label>
          <div class="ingredient-builder">
            <div class="section-heading">
              <h3>Ingredients</h3>
              <button class="ghost-btn recipe-edit-add-ingredient" type="button">Add Ingredient</button>
            </div>
            <div class="ingredient-list recipe-edit-ingredients"></div>
          </div>
          <button class="primary-btn recipe-save-btn" type="submit">Save Changes</button>
        </form>
      `;

      const ingredientContainer = item.querySelector(".recipe-edit-ingredients");
      populateIngredientRows(ingredientContainer, recipe.ingredients);

      item.querySelector(".recipe-edit-add-ingredient").addEventListener("click", () => {
        addIngredientRow(ingredientContainer);
      });

      item.querySelector(".recipe-cancel-btn").addEventListener("click", () => {
        editingRecipeId = null;
        renderRecipes();
      });

      item.querySelector(".recipe-delete-btn").addEventListener("click", () => {
        deleteRecipe(recipe.id);
      });

      item.querySelector(".recipe-edit-form").addEventListener("submit", (event) => {
        event.preventDefault();
        updateRecipe(
          recipe.id,
          item.querySelector(".recipe-edit-name").value.trim(),
          collectIngredientsFromRows(ingredientContainer)
        );
      });
    } else {
      item.innerHTML = `
        <div class="recipe-item-header">
          <strong>${escapeHtml(recipe.name)}</strong>
          <div class="recipe-actions">
            <button class="ghost-btn recipe-edit-btn" type="button">Edit</button>
            <button class="recipe-remove-btn recipe-delete-btn" type="button" aria-label="Delete recipe">&times;</button>
          </div>
        </div>
        <ul>${recipe.ingredients.map((ingredient) => `<li>${formatIngredientDisplay(ingredient)}</li>`).join("")}</ul>
      `;

      item.querySelector(".recipe-edit-btn").addEventListener("click", () => {
        editingRecipeId = recipe.id;
        renderRecipes();
      });

      item.querySelector(".recipe-delete-btn").addEventListener("click", () => {
        deleteRecipe(recipe.id);
      });
    }

    els.recipeList.appendChild(item);
  });
}

function renderRecipeSelect() {
  const placeholder = `<option value="">Select a recipe</option>`;
  const custom = `<option value="__custom__">Custom Recipe....</option>`;
  const options = state.recipes
    .map((recipe) => `<option value="${recipe.id}">${escapeHtml(recipe.name)}</option>`)
    .join("");

  els.mealRecipeSelect.innerHTML = placeholder + custom + options;
  syncCustomRecipePanel();
}

function renderWeek() {
  const activePlan = getActivePlan();
  if (!els.weekGrid) {
    return;
  }
  els.weekGrid.innerHTML = "";

  if (!activePlan) {
    els.currentPlanTitle.textContent = "Create your first meal plan";
    els.currentPlanDate.textContent = "Add a week, then start placing recipes from Monday through Sunday.";
    return;
  }

  els.currentPlanTitle.textContent = activePlan.name;
  els.currentPlanDate.textContent = formatPlanRange(activePlan.weekStart);

  const mealTypeHeights = getMealTypeHeights(activePlan);

  DAYS.forEach((day, index) => {
    const column = document.createElement("section");
    column.className = "day-column";
    column.dataset.day = day;

    const date = getDateForPlanDay(activePlan.weekStart, index);

    column.innerHTML = `
      <div class="day-header">
        <h3>${day}</h3>
        <p class="muted">${date}</p>
      </div>
      <div class="meal-stack"></div>
    `;

    const stack = column.querySelector(".meal-stack");

    MEAL_TYPES.forEach((mealType) => {
      const slot = document.createElement("section");
      slot.className = "meal-slot";
      slot.dataset.day = day;
      slot.dataset.mealType = mealType;
      slot.style.setProperty("--meal-slot-height", `${mealTypeHeights[mealType]}px`);

      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        slot.classList.add("drag-over");
      });

      slot.addEventListener("dragleave", () => {
        slot.classList.remove("drag-over");
      });

      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("drag-over");
        moveMeal(dragContext?.mealId, day, mealType);
      });

      slot.innerHTML = `
        <div class="meal-slot-header">
          <h4>${mealType}</h4>
        </div>
      `;

      const mealsForSlot = activePlan.meals.filter((meal) => meal.day === day && normalizeMealType(meal.mealType) === mealType);

      if (!mealsForSlot.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = `Drop a ${mealType.toLowerCase()} meal here or add one above.`;
        slot.appendChild(empty);
      }

      mealsForSlot.forEach((meal) => {
        const recipe = getMealRecipe(meal);
        if (!recipe) {
          return;
        }

        const mealCard = els.mealCardTemplate.content.firstElementChild.cloneNode(true);
        mealCard.dataset.mealId = meal.id;
        mealCard.querySelector(".meal-card-title").textContent = recipe.name;
        mealCard.addEventListener("dragstart", () => {
          dragContext = { mealId: meal.id };
        });

        mealCard.addEventListener("dragend", () => {
          dragContext = null;
        });

        mealCard.querySelector(".delete-chip").addEventListener("click", () => {
          removeMeal(meal.id);
        });

        slot.appendChild(mealCard);
      });

      stack.appendChild(slot);
    });

    els.weekGrid.appendChild(column);
  });
}

function getMealTypeHeights(activePlan) {
  const baseHeight = 128;
  const extraMealHeight = 88;
  const heights = {};

  MEAL_TYPES.forEach((mealType) => {
    const maxMealsForType = Math.max(
      1,
      ...DAYS.map((day) =>
        activePlan.meals.filter((meal) => meal.day === day && normalizeMealType(meal.mealType) === mealType).length
      )
    );

    heights[mealType] = baseHeight + (maxMealsForType - 1) * extraMealHeight;
  });

  return heights;
}

function renderShoppingList() {
  const activePlan = getActivePlan();
  if (!els.shoppingList) {
    return;
  }
  if (!activePlan) {
    els.shoppingList.textContent = "Choose or create a meal plan to generate a shopping list.";
    els.shoppingList.className = "shopping-list empty-state";
    return;
  }

  const ingredientCounts = new Map();

  activePlan.meals.forEach((meal) => {
    const recipe = getMealRecipe(meal);
    if (!recipe) {
      return;
    }

    recipe.ingredients.forEach((ingredient) => {
      const normalized = normalizeIngredient(ingredient);
      const key = normalized.name.toLowerCase();
      const current = ingredientCounts.get(key);

      if (current) {
        current.entries.push(normalized);
      } else {
        ingredientCounts.set(key, {
          label: normalized.name,
          entries: [normalized],
        });
      }
    });
  });

  activePlan.shoppingOverrides = activePlan.shoppingOverrides || [];

  const recipeItems = [...ingredientCounts.entries()].map(([key, ingredient]) => {
    const override = activePlan.shoppingOverrides.find((item) => item.sourceKey === key);
    if (override?.removed) {
      return null;
    }
    const suggestion = summarizeIngredientQuantities(ingredient.entries);
    return {
      id: override?.id || `recipe-${key}`,
      label: override?.label || ingredient.label,
      quantity: override?.quantity || suggestion.quantity,
      checked: override?.checked || false,
      source: getShoppingSourceLabel(override, false),
      sourceKey: key,
      manual: false,
    };
  }).filter(Boolean);

  const manualItems = activePlan.shoppingOverrides
    .filter((item) => item.source === "Manual" && !item.removed)
    .map((item) => ({
      id: item.id,
      label: item.label,
      quantity: item.quantity || "",
      checked: item.checked,
      source: getShoppingSourceLabel(item, true),
      sourceKey: null,
      manual: true,
    }));

  const allItems = [...recipeItems, ...manualItems].sort((a, b) => a.label.localeCompare(b.label));

  if (!allItems.length) {
    els.shoppingList.textContent = "No meals or manual items added yet for this week.";
    els.shoppingList.className = "shopping-list empty-state";
    return;
  }

  els.shoppingList.className = "shopping-list shopping-checklist";
  els.shoppingList.innerHTML = allItems
    .map((item) => {
      return `
        <div class="shopping-item ${item.checked ? "checked" : ""}" data-shopping-id="${item.id}" data-manual="${item.manual}" data-source-key="${item.sourceKey || ""}">
          <input class="shopping-checkbox" type="checkbox" ${item.checked ? "checked" : ""} />
          <span class="shopping-item-label">
            ${item.quantity ? `<span class="shopping-item-qty">${escapeHtml(item.quantity)}</span> ` : ""}
            ${escapeHtml(item.label)}
          </span>
          <span class="shopping-item-source">${escapeHtml(item.source)}</span>
          <button class="ghost-btn shopping-edit-btn" type="button">Edit</button>
          <button class="shopping-remove-btn shopping-delete-btn" type="button" aria-label="Remove item">&times;</button>
        </div>
      `;
    })
    .join("");

  els.shoppingList.querySelectorAll(".shopping-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const row = event.target.closest(".shopping-item");
      toggleShoppingItem(row.dataset.shoppingId, row.dataset.manual === "true", row.dataset.sourceKey, event.target.checked);
    });
  });

  els.shoppingList.querySelectorAll(".shopping-edit-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const row = event.target.closest(".shopping-item");
      const labelNode = row.querySelector(".shopping-item-label");
      const currentQty = labelNode.querySelector(".shopping-item-qty")?.textContent || "";
      const currentText = labelNode.textContent.replace(currentQty, "").trim();
      row.innerHTML = `
        <input class="shopping-checkbox" type="checkbox" ${row.classList.contains("checked") ? "checked" : ""} />
        <div class="shopping-form-row">
          <input class="shopping-item-edit-qty" type="text" value="${escapeAttribute(currentQty)}" placeholder="Quantity" />
          <input class="shopping-item-edit" type="text" value="${escapeAttribute(currentText)}" />
        </div>
        <span class="shopping-item-source">${row.querySelector(".shopping-item-source").textContent}</span>
        <button class="primary-btn shopping-save-btn" type="button">Save</button>
      `;

      row.querySelector(".shopping-checkbox").addEventListener("change", (changeEvent) => {
        toggleShoppingItem(row.dataset.shoppingId, row.dataset.manual === "true", row.dataset.sourceKey, changeEvent.target.checked);
      });

      row.querySelector(".shopping-save-btn").addEventListener("click", () => {
        const nextLabel = row.querySelector(".shopping-item-edit").value.trim();
        const nextQuantity = row.querySelector(".shopping-item-edit-qty").value.trim();
        if (!nextLabel) {
          return;
        }
        updateShoppingItem(row.dataset.shoppingId, row.dataset.manual === "true", row.dataset.sourceKey, nextLabel, nextQuantity);
      });
    });
  });

  els.shoppingList.querySelectorAll(".shopping-delete-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const row = event.target.closest(".shopping-item");
      deleteShoppingItem(row.dataset.shoppingId, row.dataset.manual === "true", row.dataset.sourceKey);
    });
  });
}

function moveMeal(mealId, newDay, newMealType) {
  const activePlan = getActivePlan();
  if (!activePlan) {
    return;
  }

  const meal = activePlan.meals.find((entry) => entry.id === mealId);
  if (!meal) {
    return;
  }

  meal.day = newDay;
  meal.mealType = newMealType;
  persistAndRender();
}

function removeMeal(mealId) {
  const activePlan = getActivePlan();
  if (!activePlan) {
    return;
  }

  activePlan.meals = activePlan.meals.filter((meal) => meal.id !== mealId);
  persistAndRender();
}

function removePlan(planId) {
  const nextPlans = state.plans.filter((plan) => plan.id !== planId);

  if (!nextPlans.length) {
    const fallbackPlan = createPlan({
      name: "This Week",
      weekStart: getMondayDateInputValue(new Date()),
    });
    state.plans = [fallbackPlan];
    state.activePlanId = fallbackPlan.id;
    persistAndRender();
    return;
  }

  state.plans = nextPlans;

  if (state.activePlanId === planId) {
    state.activePlanId = nextPlans[0].id;
  }

  persistAndRender();
}

function deleteRecipe(recipeId) {
  state.recipes = state.recipes.filter((recipe) => recipe.id !== recipeId);
  if (editingRecipeId === recipeId) {
    editingRecipeId = null;
  }

  state.plans.forEach((plan) => {
    plan.meals = plan.meals.filter((meal) => meal.recipeId !== recipeId);
  });

  persistAndRender();
}

function updateRecipe(recipeId, name, ingredients) {
  if (!name || !ingredients.length) {
    return;
  }

  const recipe = state.recipes.find((entry) => entry.id === recipeId);
  if (!recipe) {
    return;
  }

  recipe.name = name;
  recipe.ingredients = ingredients;
  editingRecipeId = null;
  persistAndRender();
}

function toggleShoppingItem(itemId, isManual, sourceKey, checked) {
  const activePlan = getActivePlan();
  if (!activePlan) {
    return;
  }

  activePlan.shoppingOverrides = activePlan.shoppingOverrides || [];
  const existing = findOrCreateShoppingOverride(activePlan, itemId, isManual, sourceKey);
  existing.checked = checked;
  persistAndRender();
}

function updateShoppingItem(itemId, isManual, sourceKey, label, quantity) {
  const activePlan = getActivePlan();
  if (!activePlan) {
    return;
  }

  activePlan.shoppingOverrides = activePlan.shoppingOverrides || [];
  const existing = findOrCreateShoppingOverride(activePlan, itemId, isManual, sourceKey);
  existing.label = label;
  existing.quantity = quantity;
  existing.updated = true;
  persistAndRender();
}

function deleteShoppingItem(itemId, isManual, sourceKey) {
  const activePlan = getActivePlan();
  if (!activePlan) {
    return;
  }

  activePlan.shoppingOverrides = activePlan.shoppingOverrides || [];

  if (isManual) {
    activePlan.shoppingOverrides = activePlan.shoppingOverrides.filter((item) => item.id !== itemId);
    persistAndRender();
    return;
  }

  const existing = findOrCreateShoppingOverride(activePlan, itemId, false, sourceKey);
  existing.removed = true;
  persistAndRender();
}

function findOrCreateShoppingOverride(activePlan, itemId, isManual, sourceKey) {
  let existing = activePlan.shoppingOverrides.find((item) => item.id === itemId);

  if (existing) {
    return existing;
  }

  if (!isManual && sourceKey) {
    existing = activePlan.shoppingOverrides.find((item) => item.sourceKey === sourceKey);
    if (existing) {
      return existing;
    }
  }

  const nextItem = {
    id: isManual ? itemId : crypto.randomUUID(),
    label: "",
    quantity: "",
    checked: false,
    source: isManual ? "Manual" : "From recipes",
    sourceKey: isManual ? null : sourceKey,
    removed: false,
    updated: false,
  };

  activePlan.shoppingOverrides.push(nextItem);
  return nextItem;
}

function getActivePlan() {
  return state.plans.find((plan) => plan.id === state.activePlanId);
}

function getMealRecipe(meal) {
  if (meal.recipeSnapshot) {
    return meal.recipeSnapshot;
  }

  return state.recipes.find((recipe) => recipe.id === meal.recipeId);
}

function hydrateDaySelects() {
  if (!els.mealDay) {
    return;
  }
  const options = DAYS.map((day) => `<option value="${day}">${day}</option>`).join("");
  els.mealDay.innerHTML = options;
}

function syncCustomRecipePanel() {
  if (!els.customRecipePanel || !els.mealRecipeSelect) {
    return;
  }

  const showCustom = els.mealRecipeSelect.value === "__custom__";
  els.customRecipePanel.classList.toggle("hidden", !showCustom);
  els.mealRecipeSelect.classList.toggle("meal-recipe-select-custom", showCustom);
  if (els.addToDayBtn) {
    els.addToDayBtn.classList.toggle("hidden", showCustom);
  }
}

function renderPlanHeader() {
  if (!els.currentPlanTitle || !els.currentPlanDate) {
    return;
  }

  const activePlan = getActivePlan();

  if (!activePlan) {
    els.currentPlanTitle.textContent = "Create your first meal plan";
    els.currentPlanDate.textContent = "Add a week, then start planning meals.";
    return;
  }

  els.currentPlanTitle.textContent = activePlan.name;
  els.currentPlanDate.textContent = formatPlanRange(activePlan.weekStart);
}

function setActiveNav() {
  const pageMap = {
    home: "index.html",
    plans: "plans.html",
    planner: "planner.html",
    recipes: "recipes.html",
    shopping: "shopping-list.html",
  };

  const currentFile = pageMap[PAGE];

  document.querySelectorAll(".nav-link").forEach((link) => {
    if (link.getAttribute("href") === `./${currentFile}`) {
      link.classList.add("active");
    }
  });
}

function hydrateSidebarState() {
  const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  setSidebarCollapsed(collapsed, false);
}

function setSidebarCollapsed(collapsed, persist = true) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);

  if (els.sidebarToggle) {
    els.sidebarToggle.textContent = collapsed ? "Collapsed" : "Collapse";
    els.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  }

  if (els.sidebarReopen) {
    els.sidebarReopen.classList.toggle("hidden", !collapsed);
  }

  if (persist) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }
}

function hydrateIngredientBuilders() {
  if (els.addRecipeIngredient && els.recipeIngredientsList) {
    els.addRecipeIngredient.addEventListener("click", () => addIngredientRow(els.recipeIngredientsList));
    resetIngredientRows(els.recipeIngredientsList);
  }

  if (els.addQuickIngredient && els.quickRecipeIngredientsList) {
    els.addQuickIngredient.addEventListener("click", () => addIngredientRow(els.quickRecipeIngredientsList));
    resetIngredientRows(els.quickRecipeIngredientsList);
  }
}

function resetIngredientRows(container) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  addIngredientRow(container);
  addIngredientRow(container);
  addIngredientRow(container);
}

function addIngredientRow(container, ingredient = { quantity: "", name: "" }) {
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input class="ingredient-qty" type="text" placeholder="1 lb, 2 cups, 3" value="${escapeAttribute(ingredient.quantity || "")}" />
    <input class="ingredient-name" type="text" placeholder="Ground turkey, milk, onions..." value="${escapeAttribute(ingredient.name || "")}" />
    <button class="delete-chip ingredient-remove-btn" type="button">Remove</button>
  `;

  row.querySelector(".ingredient-remove-btn").addEventListener("click", () => {
    row.remove();
    if (!container.children.length) {
      addIngredientRow(container);
    }
  });

  container.appendChild(row);
}

function populateIngredientRows(container, ingredients) {
  container.innerHTML = "";
  if (!ingredients.length) {
    addIngredientRow(container);
    return;
  }

  ingredients.forEach((ingredient) => {
    addIngredientRow(container, normalizeIngredient(ingredient));
  });
}

function collectIngredientsFromRows(container) {
  return [...container.querySelectorAll(".ingredient-row")]
    .map((row) => ({
      quantity: row.querySelector(".ingredient-qty").value.trim(),
      name: row.querySelector(".ingredient-name").value.trim(),
    }))
    .filter((ingredient) => ingredient.name);
}

function buildRecipeFromForm(nameInput, ingredientsContainer) {
  const ingredients = collectIngredientsFromRows(ingredientsContainer);
  if (!ingredients.length) {
    ensureIngredientRow(ingredientsContainer);
    const firstIngredientInput = ingredientsContainer.querySelector(".ingredient-name");
    if (firstIngredientInput) {
      firstIngredientInput.focus();
    }
    return null;
  }

  return createRecipe({
    name: nameInput.value.trim(),
    ingredients,
  });
}

function ensureIngredientRow(container) {
  if (!container || container.children.length) {
    return;
  }

  addIngredientRow(container);
}

function getMondayDateInputValue(date) {
  const source = new Date(date);
  const day = source.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  source.setDate(source.getDate() + diff);
  return source.toISOString().split("T")[0];
}

function getDateForPlanDay(weekStart, dayIndex) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatPlanRange(weekStart) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function normalizeMealType(value) {
  if (!value) {
    return "Dinner";
  }

  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return MEAL_TYPES.includes(normalized) ? normalized : "Dinner";
}

function normalizeIngredient(ingredient) {
  if (typeof ingredient === "string") {
    return splitIngredientText(ingredient);
  }

  const quantity = (ingredient.quantity || "").trim();
  const name = (ingredient.name || "").trim();

  if (!quantity && name) {
    return splitIngredientText(name);
  }

  return { quantity, name };
}

function summarizeIngredientQuantities(entries) {
  const cleaned = entries.filter((entry) => entry.name);
  const quantityMap = new Map();
  let withoutQuantity = 0;

  cleaned.forEach((entry) => {
    if (!entry.quantity) {
      withoutQuantity += 1;
      return;
    }

    const parsed = parseQuantity(entry.quantity);
    if (!parsed) {
      const current = quantityMap.get(entry.quantity) || 0;
      quantityMap.set(entry.quantity, current + 1);
      return;
    }

    const unitKey = parsed.unit.toLowerCase();
    const current = quantityMap.get(unitKey) || 0;
    quantityMap.set(unitKey, current + parsed.value);
  });

  const parts = [...quantityMap.entries()].map(([unit, value]) => {
    if (Number.isInteger(value)) {
      return unit ? `${value} ${unit}` : `${value}`;
    }
    const rounded = Math.round(value * 100) / 100;
    return unit ? `${rounded} ${unit}` : `${rounded}`;
  });

  if (withoutQuantity > 0) {
    parts.push(withoutQuantity > 1 ? `${withoutQuantity} items` : "1 item");
  }

  return {
    quantity: parts.join(" + "),
  };
}

function parseQuantity(quantity) {
  const match = quantity.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) {
    return null;
  }

  return {
    value: Number(match[1]),
    unit: match[2].trim(),
  };
}

function formatIngredientDisplay(ingredient) {
  const normalized = normalizeIngredient(ingredient);
  return normalized.quantity
    ? `${escapeHtml(normalized.quantity)} ${escapeHtml(normalized.name)}`
    : escapeHtml(normalized.name);
}

function getShoppingSourceLabel(item, isManual) {
  const base = isManual ? "Manual" : "From Recipe";
  return item?.updated ? `${base}, Updated` : base;
}

function splitIngredientText(value) {
  const text = value.trim();
  const match = text.match(/^(\d+(?:\.\d+)?(?:\s+[a-zA-Z]+)?)(?:\s+)(.+)$/);

  if (!match) {
    return {
      quantity: "",
      name: text,
    };
  }

  return {
    quantity: match[1].trim(),
    name: match[2].trim(),
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
