-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Admin', 'OfficeStaff', 'Cleaner');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('Residential', 'Commercial');

-- CreateEnum
CREATE TYPE "AddOnUnit" AS ENUM ('Flat', 'PerUnit');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "originAddress" TEXT,
    "defaultMarketTierKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OfficeStaff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SqftLaborTier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "minSqft" INTEGER NOT NULL,
    "maxSqft" INTEGER,
    "baseHours" DECIMAL(7,3) NOT NULL,
    "thresholdSqft" INTEGER,
    "stepSqft" INTEGER,
    "stepHours" DECIMAL(7,3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqftLaborTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedroomAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "minBeds" INTEGER NOT NULL,
    "maxBeds" INTEGER,
    "hours" DECIMAL(7,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedroomAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hours" DECIMAL(7,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureOption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hours" DECIMAL(7,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupancyMultiplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "multiplier" DECIMAL(7,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupancyMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlooringMultiplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "multiplier" DECIMAL(7,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlooringMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionMultiplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "multiplier" DECIMAL(7,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrequencyMultiplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "multiplier" DECIMAL(7,3) NOT NULL,
    "visitsPerMonth" DECIMAL(7,3),
    "isOneTime" BOOLEAN NOT NULL DEFAULT false,
    "isDeepClean" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrequencyMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "minimumCharge" DECIMAL(10,2) NOT NULL,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZipTierMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "tierKey" TEXT NOT NULL,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZipTierMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "AddOnUnit" NOT NULL DEFAULT 'Flat',
    "category" "ServiceCategory" NOT NULL DEFAULT 'Residential',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelBracket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "minMiles" INTEGER NOT NULL,
    "maxMiles" INTEGER,
    "fee" DECIMAL(10,2) NOT NULL,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTypeConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" "ServiceCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "taxable" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "multiplier" DECIMAL(7,3) NOT NULL DEFAULT 1.000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarginConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "laborCostPerHour" DECIMAL(10,2) NOT NULL,
    "suppliesPerVisit" DECIMAL(10,2) NOT NULL,
    "targetLaborPct" DECIMAL(6,4) NOT NULL,
    "laborBandMin" DECIMAL(6,4) NOT NULL,
    "laborBandMax" DECIMAL(6,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarginConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Profile_organizationId_idx" ON "Profile"("organizationId");

-- CreateIndex
CREATE INDEX "SqftLaborTier_organizationId_idx" ON "SqftLaborTier"("organizationId");

-- CreateIndex
CREATE INDEX "BedroomAdjustment_organizationId_idx" ON "BedroomAdjustment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PetAdjustment_organizationId_key_key" ON "PetAdjustment"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureOption_organizationId_key_key" ON "FeatureOption"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OccupancyMultiplier_organizationId_key_key" ON "OccupancyMultiplier"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FlooringMultiplier_organizationId_key_key" ON "FlooringMultiplier"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionMultiplier_organizationId_key_key" ON "ConditionMultiplier"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FrequencyMultiplier_organizationId_key_key" ON "FrequencyMultiplier"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MarketTier_organizationId_key_key" ON "MarketTier"("organizationId", "key");

-- CreateIndex
CREATE INDEX "ZipTierMapping_organizationId_idx" ON "ZipTierMapping"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ZipTierMapping_organizationId_zip_key" ON "ZipTierMapping"("organizationId", "zip");

-- CreateIndex
CREATE UNIQUE INDEX "AddOn_organizationId_key_key" ON "AddOn"("organizationId", "key");

-- CreateIndex
CREATE INDEX "TravelBracket_organizationId_idx" ON "TravelBracket"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_organizationId_jurisdiction_key" ON "TaxRate"("organizationId", "jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTypeConfig_organizationId_key_key" ON "ServiceTypeConfig"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyType_organizationId_key_key" ON "PropertyType"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PricingSetting_organizationId_key_key" ON "PricingSetting"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MarginConfig_organizationId_key" ON "MarginConfig"("organizationId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SqftLaborTier" ADD CONSTRAINT "SqftLaborTier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedroomAdjustment" ADD CONSTRAINT "BedroomAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetAdjustment" ADD CONSTRAINT "PetAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureOption" ADD CONSTRAINT "FeatureOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancyMultiplier" ADD CONSTRAINT "OccupancyMultiplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlooringMultiplier" ADD CONSTRAINT "FlooringMultiplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionMultiplier" ADD CONSTRAINT "ConditionMultiplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrequencyMultiplier" ADD CONSTRAINT "FrequencyMultiplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTier" ADD CONSTRAINT "MarketTier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZipTierMapping" ADD CONSTRAINT "ZipTierMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelBracket" ADD CONSTRAINT "TravelBracket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTypeConfig" ADD CONSTRAINT "ServiceTypeConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyType" ADD CONSTRAINT "PropertyType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSetting" ADD CONSTRAINT "PricingSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginConfig" ADD CONSTRAINT "MarginConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

