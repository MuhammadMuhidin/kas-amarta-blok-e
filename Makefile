.PHONY: build up down

SHA7 := $(shell date +%s%N | sha1sum | cut -c1-7)
IMAGE := kas-amarta:$(SHA7)
NEXT_PUBLIC_SUPABASE_URL := $(shell grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d'=' -f2)
NEXT_PUBLIC_SUPABASE_ANON_KEY := $(shell grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env | cut -d'=' -f2)

build:
	docker build \
		--build-arg NEXT_PUBLIC_SUPABASE_URL=$(NEXT_PUBLIC_SUPABASE_URL) \
		--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$(NEXT_PUBLIC_SUPABASE_ANON_KEY) \
		-t $(IMAGE) . && \
	docker image prune -f && \
	echo $(IMAGE) > .image.tag && \
	echo "✓ $(IMAGE)"

up:
	DOCKER_IMAGE=$$(cat .image.tag) docker compose up -d && \
	echo "✓ Started"

down:
	DOCKER_IMAGE=$$(cat .image.tag) docker compose down && \
	echo "✓ Stopped"
