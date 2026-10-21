CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" varchar(2000),
	"price_in_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PLN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_price_in_cents_non_negative" CHECK ("products"."price_in_cents" >= 0)
);
