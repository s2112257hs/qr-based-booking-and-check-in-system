ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "password_hash" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
