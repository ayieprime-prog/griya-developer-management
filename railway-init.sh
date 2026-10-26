#!/bin/bash

echo "🚀 Initializing PostgreSQL Database..."
echo "📊 Running seed script: npm run seed-pg"

npm run seed-pg

if [ $? -eq 0 ]; then
  echo "✅ Database initialization successful!"
  echo "📝 Schema created and demo users seeded"
  exit 0
else
  echo "❌ Database initialization failed!"
  exit 1
fi
