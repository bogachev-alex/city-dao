-- Game simulation: clock + event log + jury game-day fields

CREATE TABLE "GameState" (
    "id" TEXT NOT NULL,
    "gameDay" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameDay" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameEvent_gameDay_idx" ON "GameEvent"("gameDay");
CREATE INDEX "GameEvent_type_idx" ON "GameEvent"("type");

ALTER TABLE "JurySession" ADD COLUMN "commitPhaseStartedGameDay" INTEGER;
ALTER TABLE "JurySession" ADD COLUMN "revealPhaseStartedGameDay" INTEGER;

INSERT INTO "GameState" ("id", "gameDay", "startDate", "isPaused", "updatedAt")
VALUES ('singleton', 0, CURRENT_TIMESTAMP, false, CURRENT_TIMESTAMP);
