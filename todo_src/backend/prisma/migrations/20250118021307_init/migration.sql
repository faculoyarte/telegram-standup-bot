-- CreateEnum
CREATE TYPE "Department" AS ENUM ('engineering', 'sales', 'marketing');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NOT_STARTED', 'BLOCKED', 'WIP', 'ABANDONED', 'DONE', 'RE_OPENED');

-- CreateEnum
CREATE TYPE "TimeScale" AS ENUM ('MINUTES', 'HOURS', 'DAYS', 'WEEKS');

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeId" INTEGER,
    "creatorId" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "blockerTaskId" INTEGER,
    "parentTaskId" INTEGER,
    "status" "Status" NOT NULL,
    "percentDone" INTEGER,
    "priority" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "timeEstimate" INTEGER NOT NULL,
    "timeActual" INTEGER,
    "timeScale" "TimeScale" NOT NULL,
    "doneCriteria" TEXT,
    "whyDeadline" VARCHAR(80),
    "why" VARCHAR(80) NOT NULL,
    "tags" VARCHAR(255),
    "links" TEXT,
    "managerFeedback" TEXT,
    "associatedIssues" INTEGER,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "telegramUserId" VARCHAR(50) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockerTaskId_fkey" FOREIGN KEY ("blockerTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
