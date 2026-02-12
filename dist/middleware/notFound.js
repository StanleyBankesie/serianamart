export function notFound(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
}
