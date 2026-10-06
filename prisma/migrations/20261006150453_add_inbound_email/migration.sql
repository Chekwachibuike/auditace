-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ingestToken" TEXT;

-- CreateTable
CREATE TABLE "inbound_emails" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "parserName" TEXT,
    "parseError" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_emails_userId_status_idx" ON "inbound_emails"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_userId_messageId_key" ON "inbound_emails"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "users_ingestToken_key" ON "users"("ingestToken");

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

