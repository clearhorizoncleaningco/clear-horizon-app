-- Phase 2 (BUILD_SPEC §G) — customer records, saved estimates, branded proposals,
-- e-approval, 30-day expiration, and the (stubbed) one-way GoHighLevel push.
--
-- Generated from `prisma migrate diff` against the Phase 1 baseline (0_init).
-- Apply with `npm run db:deploy`.

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('Draft', 'Saved', 'Proposed', 'Approved', 'Declined', 'Expired');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('Draft', 'Sent', 'Approved', 'Declined', 'Expired');

-- CreateEnum
CREATE TYPE "GhlPushStatus" AS ENUM ('NotPushed', 'Stubbed', 'Pushed', 'Failed');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ServiceCategory" NOT NULL DEFAULT 'Residential',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "address" TEXT,
    "city" TEXT,
    "zip" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'Saved',
    "inputJson" JSONB NOT NULL,
    "resultJson" JSONB NOT NULL,
    "summary" TEXT,
    "headlinePrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "frequencyKey" TEXT,
    "frequencyLabel" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "projectedMonthly" DECIMAL(10,2),
    "initialDeepCleanPrice" DECIMAL(10,2),
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'Sent',
    "documentJson" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "agreed" BOOLEAN NOT NULL DEFAULT false,
    "signerName" TEXT,
    "signerIp" TEXT,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "ghlStatus" "GhlPushStatus" NOT NULL DEFAULT 'NotPushed',
    "ghlPayload" JSONB,
    "ghlResponse" JSONB,
    "ghlPushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_email_idx" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Customer_organizationId_phoneNormalized_idx" ON "Customer"("organizationId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "Estimate_organizationId_idx" ON "Estimate"("organizationId");

-- CreateIndex
CREATE INDEX "Estimate_organizationId_createdAt_idx" ON "Estimate"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Estimate_customerId_idx" ON "Estimate"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_token_key" ON "Proposal"("token");

-- CreateIndex
CREATE INDEX "Proposal_organizationId_idx" ON "Proposal"("organizationId");

-- CreateIndex
CREATE INDEX "Proposal_estimateId_idx" ON "Proposal"("estimateId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
