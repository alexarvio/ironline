// Builds app/lib/foods/common.json: the everyday foods a client actually
// types ("white rice, cooked", "banana"), each pointing at the catalog row
// that stands for it. The search shows these first, under their plain
// names; the catalog's long tail folds away under "more".
//
//   node scripts/build-common-foods.mjs
//
// Each line: [plain name, words that must all appear in the catalog name,
// words that must not]. The shortest catalog name that fits wins; the script
// prints every match so a wrong one is easy to spot.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(here, "..", "app", "lib", "foods", "catalog.json"), "utf8"));

const SPEC = [
  // Grains, bread, potatoes
  ["White rice, cooked", ["rice, white, long-grain, regular, enriched, cooked"]],
  ["White rice, uncooked", ["rice, white, long-grain, regular, raw, enriched"]],
  ["Brown rice, cooked", ["rice, brown, long-grain, cooked"]],
  ["Brown rice, uncooked", ["rice, brown, long-grain, raw"]],
  ["Basmati rice, cooked", ["rice, white, long-grain, regular, enriched, cooked"]],
  ["Jasmine rice, cooked", ["rice, white, long-grain, regular, enriched, cooked"]],
  ["Pasta, cooked", ["pasta, cooked, enriched, without added salt"]],
  ["Pasta, uncooked", ["pasta, dry, enriched"]],
  ["Whole wheat pasta, cooked", ["pasta, whole-wheat, cooked"]],
  ["Oats, dry", ["oats"], ["cooked", "instant", "bran", "flour", "cereals ready"]],
  ["Oatmeal, cooked with water", ["cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt"]],
  ["Couscous, cooked", ["couscous, cooked"]],
  ["Quinoa, cooked", ["quinoa, cooked"]],
  ["Bulgur, cooked", ["bulgur, cooked"]],
  ["Potato, boiled", ["potatoes, boiled, cooked without skin, flesh, without salt"]],
  ["Potato, baked with skin", ["potatoes, baked, flesh and skin, without salt"]],
  ["Potato, raw", ["potatoes, flesh and skin, raw"]],
  ["Sweet potato, baked", ["sweet potato, cooked, baked in skin, flesh, without salt"]],
  ["Sweet potato, boiled", ["sweet potato, cooked, boiled, without skin"]],
  ["French fries", ["fast foods, potato, french fried in vegetable oil"]],
  ["White bread", ["bread, white, commercially prepared"], ["toasted", "crumbs", "low sodium", "reduced"]],
  ["Whole wheat bread", ["bread, whole-wheat, commercially prepared"], ["toasted"]],
  ["Rye bread", ["bread, rye"], ["toasted", "reduced", "pumpernickel"]],
  ["Sourdough bread", ["bread, french or vienna"], ["toasted", "whole"]],
  ["Bagel", ["bagels, plain"], ["toasted", "cinnamon"]],
  ["Tortilla, flour", ["tortillas, ready-to-bake or -fry, flour"], ["refrigerated", "whole"]],
  ["Tortilla, corn", ["tortillas, ready-to-bake or -fry, corn"]],
  ["Pita bread", ["bread, pita, white"], ["whole"]],
  ["Crackers", ["crackers, saltines"], ["fat-free", "low sodium", "unsalted", "whole"]],
  ["Rice cakes", ["rice cakes, brown rice, plain"]],
  ["Granola", ["cereals ready-to-eat, granola, homemade"]],
  ["Cornflakes", ["cereals ready-to-eat, ralston corn flakes"]],
  ["Pancakes", ["pancakes, plain, prepared from recipe"]],
  ["Flour, wheat", ["wheat flour, white, all-purpose, enriched, bleached"]],
  // Eggs & dairy
  ["Egg, whole", ["egg, whole, raw, fresh"]],
  ["Egg, boiled", ["egg, whole, cooked, hard-boiled"]],
  ["Egg, fried", ["egg, whole, cooked, fried"]],
  ["Egg, scrambled", ["egg, whole, cooked, scrambled"]],
  ["Egg white", ["egg, white, raw, fresh"]],
  ["Egg yolk", ["egg, yolk, raw, fresh"]],
  ["Milk, whole", ["milk, whole, 3.25% milkfat, with added vitamin d"]],
  ["Milk, semi-skimmed (2%)", ["milk, reduced fat, fluid, 2% milkfat, with added vitamin a and vitamin d"]],
  ["Milk, skimmed", ["milk, nonfat, fluid, with added vitamin a and vitamin d (fat free or skim)"]],
  ["Oat milk", ["oat milk, unsweetened, plain, refrigerated"]],
  ["Almond milk", ["beverages, almond milk, unsweetened, shelf stable"]],
  ["Soy milk", ["soy milk, unsweetened, plain, shelf stable"]],
  ["Greek yogurt, plain", ["yogurt, greek, plain, nonfat"]],
  ["Greek yogurt, whole milk", ["yogurt, greek, plain, whole milk"]],
  ["Yogurt, plain", ["yogurt, plain, low fat"]],
  ["Skyr", ["yogurt, greek, plain, nonfat"]],
  ["Quark", ["cheese, cottage, lowfat, 1% milkfat"]],
  ["Cottage cheese", ["cheese, cottage, creamed, large or small curd"]],
  ["Cheddar cheese", ["cheese, cheddar"], ["reduced", "nonfat", "sharp", "low"]],
  ["Mozzarella", ["cheese, mozzarella, whole milk"]],
  ["Parmesan", ["cheese, parmesan, grated"]],
  ["Feta", ["cheese, feta"]],
  ["Gouda", ["cheese, gouda"]],
  ["Cream cheese", ["cheese, cream"], ["fat free", "low fat", "reduced"]],
  ["Butter", ["butter, salted"]],
  ["Cream, heavy", ["cream, fluid, heavy whipping"]],
  ["Whey protein powder", ["beverages, protein powder whey based"]],
  // Meat, fish, plant protein
  ["Chicken breast, cooked", ["chicken, breast, meat only, cooked, roasted"]],
  ["Chicken breast, raw", ["chicken, breast, boneless, skinless, raw"]],
  ["Chicken thigh, cooked", ["chicken, thigh, meat only, cooked, roasted"]],
  ["Chicken, whole, roasted", ["chicken, meat and skin, cooked, roasted"]],
  ["Turkey breast, cooked", ["turkey, retail parts, breast, meat only, cooked, roasted"]],
  ["Minced beef 5%, cooked", ["beef, ground, 95% lean meat / 5% fat, patty, cooked, broiled"]],
  ["Minced beef 15%, cooked", ["beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled"]],
  ["Minced beef 20%, cooked", ["beef, ground, 80% lean meat / 20% fat, patty, cooked, broiled"]],
  ["Beef steak, cooked", ["beef, top sirloin, steak, separable lean only, trimmed to 0\" fat, choice, cooked, broiled"]],
  ["Pork chop, cooked", ["pork, fresh, loin, center loin (chops), bone-in, separable lean only, cooked, broiled"]],
  ["Pork tenderloin, cooked", ["pork, fresh, loin, tenderloin, separable lean only, cooked, roasted"]],
  ["Bacon", ["pork, cured, bacon, cooked, baked"]],
  ["Ham", ["ham, sliced, regular (approximately 11% fat)"]],
  ["Salmon, cooked", ["fish, salmon, atlantic, farmed, cooked, dry heat"]],
  ["Salmon, raw", ["fish, salmon, atlantic, farmed, raw"]],
  ["Tuna, canned in water", ["fish, tuna, light, canned in water, drained solids"]],
  ["Tuna, canned in oil", ["fish, tuna, light, canned in oil, drained solids"]],
  ["Cod, cooked", ["fish, cod, atlantic, cooked, dry heat"]],
  ["Shrimp, cooked", ["crustaceans, shrimp, cooked"], ["breaded", "canned"]],
  ["Tofu, firm", ["tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)"]],
  ["Tempeh", ["tempeh"], ["cooked"]],
  ["Lentils, cooked", ["lentils, mature seeds, cooked, boiled, without salt"]],
  ["Chickpeas, cooked", ["chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt"]],
  ["Black beans, cooked", ["beans, black, mature seeds, cooked, boiled, without salt"]],
  ["Kidney beans, canned", ["beans, kidney, red, mature seeds, canned, solids and liquids"]],
  ["Baked beans", ["beans, baked, canned, plain or vegetarian"]],
  ["Edamame", ["edamame, frozen, prepared"]],
  ["Hummus", ["hummus, commercial"]],
  // Fruit
  ["Apple", ["apples, raw, with skin"]],
  ["Banana", ["bananas, raw"]],
  ["Orange", ["oranges, raw, all commercial varieties"]],
  ["Strawberries", ["strawberries, raw"]],
  ["Blueberries", ["blueberries, raw"]],
  ["Raspberries", ["raspberries, raw"]],
  ["Grapes", ["grapes, red or green (european type, such as thompson seedless), raw"]],
  ["Pear", ["pears, raw"], ["asian", "bartlett", "bosc", "anjou", "green"]],
  ["Peach", ["peaches, yellow, raw"]],
  ["Pineapple", ["pineapple, raw, all varieties"]],
  ["Mango", ["mangos, raw"]],
  ["Watermelon", ["watermelon, raw"]],
  ["Kiwi", ["kiwifruit, green, raw"]],
  ["Avocado", ["avocados, raw, all commercial varieties"]],
  ["Cherries", ["cherries, sweet, raw"]],
  ["Dates", ["dates, medjool"]],
  ["Raisins", ["raisins, dark, seedless"]],
  ["Lemon", ["lemons, raw, without peel"]],
  // Vegetables
  ["Broccoli, cooked", ["broccoli, cooked, boiled, drained, without salt"]],
  ["Broccoli, raw", ["broccoli, raw"]],
  ["Spinach, raw", ["spinach, raw"]],
  ["Spinach, cooked", ["spinach, cooked, boiled, drained, without salt"]],
  ["Carrot, raw", ["carrots, raw"]],
  ["Carrot, cooked", ["carrots, cooked, boiled, drained, without salt"]],
  ["Tomato", ["tomatoes, red, ripe, raw, year round average"]],
  ["Cucumber", ["cucumber, with peel, raw"]],
  ["Bell pepper", ["peppers, sweet, red, raw"]],
  ["Onion", ["onions, raw"]],
  ["Garlic", ["garlic, raw"]],
  ["Lettuce", ["lettuce, romaine"]],
  ["Mixed salad leaves", ["lettuce, green leaf, raw"]],
  ["Mushrooms", ["mushrooms, white, raw"]],
  ["Zucchini", ["squash, summer, zucchini, includes skin, raw"]],
  ["Cauliflower, cooked", ["cauliflower, cooked, boiled, drained, without salt"]],
  ["Green beans, cooked", ["beans, snap, green, cooked, boiled, drained, without salt"]],
  ["Peas, cooked", ["peas, green, cooked, boiled, drained, without salt"]],
  ["Corn, sweet", ["corn, sweet, yellow, cooked, boiled, drained, without salt"]],
  ["Kale, raw", ["kale, raw"]],
  ["Asparagus, cooked", ["asparagus, cooked, boiled, drained"]],
  ["Beetroot, cooked", ["beets, cooked, boiled, drained"]],
  ["Celery", ["celery, raw"]],
  // Nuts, seeds, fats
  ["Almonds", ["nuts, almonds"], ["blanched", "roasted", "oil", "dry", "honey"]],
  ["Walnuts", ["nuts, walnuts, english"]],
  ["Cashews", ["nuts, cashew nuts, raw"]],
  ["Peanuts", ["peanuts, all types, raw"]],
  ["Peanut butter", ["peanut butter, smooth style, with salt"]],
  ["Almond butter", ["nuts, almond butter, plain, without salt added"]],
  ["Chia seeds", ["seeds, chia seeds, dried"]],
  ["Flaxseed", ["seeds, flaxseed"]],
  ["Pumpkin seeds", ["seeds, pumpkin and squash seed kernels, dried"]],
  ["Sunflower seeds", ["seeds, sunflower seed kernels, dried"]],
  ["Olive oil", ["oil, olive, salad or cooking"]],
  ["Coconut oil", ["oil, coconut"]],
  ["Sunflower oil", ["oil, sunflower, linoleic, (approx. 65%)"]],
  ["Mayonnaise", ["salad dressing, mayonnaise, regular"]],
  ["Ketchup", ["catsup"], ["low sodium"]],
  ["Honey", ["honey"]],
  ["Sugar", ["sugars, granulated"]],
  ["Maple syrup", ["syrups, maple"]],
  ["Jam", ["jams and preserves"], ["apricot", "no sugar", "dietetic"]],
  ["Dark chocolate", ["chocolate, dark, 70-85% cacao solids"]],
  ["Milk chocolate", ["candies, milk chocolate"]],
  ["Cocoa powder", ["cocoa, dry powder, unsweetened"]],
  // Drinks
  ["Orange juice", ["orange juice, raw"]],
  ["Apple juice", ["apple juice, canned or bottled, unsweetened, without added ascorbic acid"]],
  ["Cola", ["beverages, carbonated, cola, regular"]],
  ["Beer", ["alcoholic beverage, beer, regular, all"]],
  ["Wine, red", ["alcoholic beverage, wine, table, red"]],
  ["Wine, white", ["alcoholic beverage, wine, table, white"]],
  ["Coffee, black", ["beverages, coffee, brewed, prepared with tap water"]],
  ["Latte (whole milk)", ["milk, whole, 3.25% milkfat, with added vitamin d"]],
  ["Protein shake (whey, water)", ["beverages, protein powder whey based"]],
  // Meals & snacks
  ["Pizza, cheese", ["pizza, cheese topping, regular crust, frozen, cooked"]],
  ["Hamburger", ["fast foods, hamburger; single, regular patty; plain"]],
  ["Cheeseburger", ["fast foods, cheeseburger; single, regular patty; plain"]],
  ["Sushi (salmon roll)", ["fish, salmon, atlantic, farmed, raw"]],
  ["Ice cream, vanilla", ["ice creams, vanilla"], ["light", "rich", "soft", "fat"]],
  ["Potato chips", ["snacks, potato chips, plain, salted"]],
  ["Popcorn, air-popped", ["snacks, popcorn, air-popped"]],
  ["Chocolate chip cookie", ["cookies, chocolate chip, commercially prepared, regular, higher fat, enriched"]],
  ["Croissant", ["croissants, butter"]],
  ["Muffin, blueberry", ["muffins, blueberry, commercially prepared"]],
  ["Protein bar", ["snacks, granola bars, soft, uncoated, chocolate chip"]],
];

const byName = new Map(catalog.map((f) => [f.name.toLowerCase(), f]));
const out = [];
const seen = new Set();
for (const [plain, must, not = []] of SPEC) {
  let row = byName.get(must[0]);
  if (!row) {
    const hits = catalog.filter((f) => {
      const n = f.name.toLowerCase();
      return must.every((w) => n.includes(w)) && !not.some((w) => n.includes(w));
    });
    hits.sort((a, b) => a.name.length - b.name.length);
    row = hits[0];
  }
  if (!row) {
    console.log(`?? ${plain}  ← no match for ${JSON.stringify(must)}`);
    continue;
  }
  console.log(`${plain.padEnd(30)} → ${row.name}  (${row.kcal} kcal)`);
  const key = plain.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({ name: plain, id: row.id });
}
const dest = path.join(here, "..", "app", "lib", "foods", "common.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${out.length} common foods → ${path.relative(process.cwd(), dest)}`);
