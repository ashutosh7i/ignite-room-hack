import dotenv from "dotenv";

dotenv.config();

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/prisma.js";
import { buildContext } from "../src/services/context/buildContext.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(
  __dirname,
  "../../Dataset for PS-3 (Ignite Room).csv",
);

const DEMO_TICKET = "My API has stopped working";

async function main() {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];

  console.log(`Importing ${rows.length} users from CSV...`);

  await prisma.supportCase.deleteMany();
  await prisma.userContext.deleteMany();
  await prisma.platformActivity.deleteMany();
  await prisma.user.deleteMany();

  const userIds: string[] = [];

  for (const row of rows) {
    const user = await prisma.user.create({
      data: {
        firstName: (row.first_name ?? "").trim() || "Unknown",
        lastName: (row.last_name ?? "").trim(),
        linkedin: row["What is your LinkedIn profile?"]?.trim() || null,
        github: row["What is your GitHub username?"]?.trim() || null,
        organization:
          row[
            "What company do you work for? (if student then write your college name)"
          ]?.trim() || null,
        jobTitle: row["What is your job title?"]?.trim() || null,
      },
    });
    userIds.push(user.id);

    const daysAgo = 30 + (userIds.length % 120);
    await prisma.platformActivity.create({
      data: {
        userId: user.id,
        accountCreatedAt: daysAgoAgo(daysAgo),
        sdk: "node",
        sdkVersion: "4.2",
        dailyRequests: 500 + (userIds.length % 50) * 100,
        historicalErrorRate: 0.003,
        currentErrorRate: 0.002 + (userIds.length % 10) * 0.0005,
        apiKeyConfigured: true,
        features: ["rest", "webhooks"],
        lastConfigChangeAt: null,
        totalRequestsEver: 10_000 + userIds.length * 100,
      },
    });
  }

  if (rows.length < 2) {
    throw new Error("CSV needs at least 2 rows for demo users");
  }

  const userBId = userIds[0];
  const userAId = userIds[1];

  await prisma.user.update({
    where: { id: userBId },
    data: { demoRole: "B" },
  });
  await prisma.user.update({
    where: { id: userAId },
    data: { demoRole: "A" },
  });

  await applyDemoActivityB(userBId);
  await applyDemoActivityA(userAId);

  await prisma.supportCase.createMany({
    data: [
      { userId: userAId, message: DEMO_TICKET, status: "open" },
      { userId: userBId, message: DEMO_TICKET, status: "open" },
    ],
  });

  // Incident cluster: a few users similar to B for bonus demo
  const clusterUsers = userIds.slice(10, 15);
  for (const uid of clusterUsers) {
    await prisma.platformActivity.update({
      where: { userId: uid },
      data: {
        sdk: "node",
        sdkVersion: "4.2",
        dailyRequests: 95_000 + Math.floor(Math.random() * 50_000),
        historicalErrorRate: 0.003,
        currentErrorRate: 0.75 + Math.random() * 0.15,
        apiKeyConfigured: true,
        features: ["rest", "realtime"],
        lastConfigChangeAt: null,
      },
    });
  }

  console.log("Building context for demo users A & B (calls Jev)...");
  if (process.env.OPENROUTER_API_KEY) {
    await buildContext(userAId);
    await buildContext(userBId);
    for (const uid of clusterUsers.slice(0, 3)) {
      await buildContext(uid);
    }
  } else {
    console.warn("OPENROUTER_API_KEY missing — skip context build");
  }

  const userA = await prisma.user.findUnique({ where: { id: userAId } });
  const userB = await prisma.user.findUnique({ where: { id: userBId } });

  console.log("Seed complete.");
  console.log(
    `User A (onboarding): ${userAId} — ${userA?.firstName} ${userA?.lastName}`,
  );
  console.log(
    `User B (production): ${userBId} — ${userB?.firstName} ${userB?.lastName}`,
  );
}

function daysAgoAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function applyDemoActivityA(userId: string) {
  await prisma.platformActivity.update({
    where: { userId },
    data: {
      accountCreatedAt: daysAgoAgo(1),
      sdk: "node",
      sdkVersion: "4.2",
      dailyRequests: 12,
      historicalErrorRate: 0,
      currentErrorRate: 1,
      apiKeyConfigured: false,
      features: ["rest"],
      lastConfigChangeAt: null,
      totalRequestsEver: 12,
    },
  });
}

async function applyDemoActivityB(userId: string) {
  await prisma.platformActivity.update({
    where: { userId },
    data: {
      accountCreatedAt: daysAgoAgo(190),
      sdk: "node",
      sdkVersion: "4.2",
      dailyRequests: 120_000,
      historicalErrorRate: 0.003,
      currentErrorRate: 0.87,
      apiKeyConfigured: true,
      features: ["rest", "realtime"],
      lastConfigChangeAt: daysAgoAgo(180),
      totalRequestsEver: 22_000_000,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
