// Case-insensitive partial matching for medicine names.
// Names that start with the query come first, then names that contain it elsewhere.
export function matchMedicines(names, query, limit = 8) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return []
  const starts = []
  const contains = []
  for (const name of names) {
    const n = name.toLowerCase()
    if (n.startsWith(q)) starts.push(name)
    else if (n.includes(q)) contains.push(name)
  }
  const byName = (a, b) => a.localeCompare(b)
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit)
}

// Find the dataset key for a typed name, ignoring case and surrounding spaces.
export function resolveMedicineName(names, typed) {
  const t = (typed ?? '').trim().toLowerCase()
  return names.find(n => n.toLowerCase() === t) ?? null
}
