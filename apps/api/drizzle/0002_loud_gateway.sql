CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(255) NOT NULL,
	"unit_price_in_cents" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price_in_cents" >= 0),
	CONSTRAINT "order_items_quantity_range" CHECK ("order_items"."quantity" >= 1 AND "order_items"."quantity" <= 99)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'pending_payment' NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"street" varchar(200) NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"city" varchar(100) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"total_in_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_total_in_cents_non_negative" CHECK ("orders"."total_in_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE restrict ON UPDATE no action;