/* Seeds one test client and a small exercise library so the app has real data on first load.
   Pure JSON file — no native modules, no compiler needed. */
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..");
const DB_PATH = path.join(DATA_DIR, "ironline.json");

function load() {
  if (!fs.existsSync(DB_PATH)) {
    return { clients: [], exercises: [], program_days: [], workout_assignments: [], set_logs: [], _seq: {} };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const data = load();

if (data.clients.length === 0) {
  data.clients.push({ id: 1, name: "Alex" });
  data._seq.clients = 1;
  console.log("Seeded client: Alex (id=1)");
} else {
  console.log("Clients already present, skipping client seed.");
}

if (data.exercises.length === 0) {
  const names = [
    ["Leg Press", "quads,glutes"],
    ["Leg Extension", "quads"],
    ["Seated Leg Curl", "hamstrings"],
    ["Incline Chest Press Machine", "chest,shoulders"],
    ["Flat Chest Press Machine", "chest"],
    ["Seated Cable Row", "back"],
    ["Lat Pulldown", "back,lats"],
    ["Side Raise Machine", "shoulders"],
    ["Bar Tricep Pushdown", "triceps"],
    ["Seated Alternating Dumbbell Curl", "biceps"],
    ["Calf Press", "calves"],
    ["Incline Dumbbell Curl", "biceps"],
  ];
  let nextId = (data._seq.exercises || 0);
  names.forEach(([name, tags]) => {
    nextId += 1;
    data.exercises.push({ id: nextId, name, muscle_tags: tags, video_url: null });
  });
  data._seq.exercises = nextId;
  console.log(`Seeded ${names.length} exercises.`);
} else {
  console.log("Exercises already present, skipping exercise seed.");
}

save(data);
console.log("Done. Data file:", DB_PATH);
