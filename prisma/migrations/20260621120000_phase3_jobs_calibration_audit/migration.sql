-- Phase 3 (BUILD_SPEC §G) — light operations & the data loop:
-- jobs (created from estimates), before/after photos for a customer report,
-- the in-app calibration actuals, cleaner earnings, and audit logs on pricing
-- changes.
--
-- Generated from `prisma migrate diff` against the Phase 2 schema. Apply with
-- `npm run db:deploy`.

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('Scheduled', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "JobPhotoKind" AS ENUM ('Before', 'After');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimateId" TEXT,
    "customerId" TEXT,
    "category" "ServiceCategory" NOT NULL DEFAULT 'Residential',
    "status" "JobStatus" NOT NULL DEFAULT 'Scheduled',
    "summary" TEXT,
    "customerName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "zip" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "assignedToId" UUID,
    "assignedToName" TEXT,
    "assignedToEmail" TEXT,
    "quotedPrice" DECIMAL(10,2) NOT NULL,
    "estProductionHours" DECIMAL(7,3),
    "estLaborCost" DECIMAL(10,2),
    "priceCharged" DECIMAL(10,2),
    "actualCrewHours" DECIMAL(7,3),
    "actualLaborCost" DECIMAL(10,2),
    "actualSuppliesCost" DECIMAL(10,2),
    "calibrationNotes" TEXT,
    "calibratedAt" TIMESTAMP(3),
    "cleanerPayAmount" DECIMAL(10,2),
    "reportToken" TEXT NOT NULL,
    "reportPublished" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "JobPhotoKind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "caption" TEXT,
    "room" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "uploadedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "category" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityLabel" TEXT,
    "field" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_reportToken_key" ON "Job"("reportToken");

-- CreateIndex
CREATE INDEX "Job_organizationId_idx" ON "Job"("organizationId");

-- CreateIndex
CREATE INDEX "Job_organizationId_status_idx" ON "Job"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Job_organizationId_completedAt_idx" ON "Job"("organizationId", "completedAt");

-- CreateIndex
CREATE INDEX "Job_assignedToId_idx" ON "Job"("assignedToId");

-- CreateIndex
CREATE INDEX "Job_estimateId_idx" ON "Job"("estimateId");

-- CreateIndex
CREATE INDEX "Job_customerId_idx" ON "Job"("customerId");

-- CreateIndex
CREATE INDEX "JobPhoto_organizationId_idx" ON "JobPhoto"("organizationId");

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_idx" ON "JobPhoto"("jobId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
