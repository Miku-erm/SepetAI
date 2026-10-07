-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'laptop',
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "cpu" TEXT NOT NULL,
    "gpu" TEXT NOT NULL,
    "ramGb" INTEGER NOT NULL,
    "storageGb" INTEGER NOT NULL,
    "screenSize" REAL NOT NULL,
    "refreshRate" INTEGER NOT NULL,
    "weightKg" REAL NOT NULL,
    "batteryHours" INTEGER NOT NULL,
    "purposeTags" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'demo',
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_key" ON "CartItem"("userId", "productId");
