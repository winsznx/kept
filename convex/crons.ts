import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("expire public demo sessions", { hours: 1 }, internal.demo.cleanupExpired, {});

export default crons;
