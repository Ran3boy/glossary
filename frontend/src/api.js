export async function fetchTerms() {
  const res = await fetch('/api/terms')
  if (!res.ok) throw new Error('Failed to load terms')
  return res.json()
}

export async function fetchGraph() {
  const res = await fetch('/api/graph')
  if (!res.ok) throw new Error('Failed to load graph')
  return res.json()
}
