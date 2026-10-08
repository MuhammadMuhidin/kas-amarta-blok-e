.PHONY: build-push-up down logs clean help

RANDOM_SHA7 := $(shell date +%s%N | sha1sum | cut -c1-7)
IMAGE_NAME := $(RANDOM_SHA7)-kas-amarta
DOCKER_HUB_USER := muhidin
IMAGE_FULL := $(DOCKER_HUB_USER)/kas-amarta:$(RANDOM_SHA7)

# Extract Supabase env vars for build
NEXT_PUBLIC_SUPABASE_URL := $(shell grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d'=' -f2)
NEXT_PUBLIC_SUPABASE_ANON_KEY := $(shell grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env | cut -d'=' -f2)

help:
	@echo "Available targets:"
	@echo "  make build-push-up - Build → Push to Docker Hub → Start container"
	@echo "  make down          - Stop container"
	@echo "  make logs          - View container logs"
	@echo "  make clean         - Remove container and volumes"

build-push-up:
	docker builder prune -af && \
	docker build \
		--build-arg NEXT_PUBLIC_SUPABASE_URL=$(NEXT_PUBLIC_SUPABASE_URL) \
		--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$(NEXT_PUBLIC_SUPABASE_ANON_KEY) \
		-t $(IMAGE_NAME) . && \
	echo "=== Tagging and pushing to Docker Hub ===" && \
	docker tag $(IMAGE_NAME) $(IMAGE_FULL) && \
	docker push $(IMAGE_FULL) && \
	echo "=== Starting container ===" && \
	DOCKER_IMAGE=$(IMAGE_FULL) docker compose up -d && \
	echo "✓ Complete: $(IMAGE_FULL)" && \
	docker compose ps

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down -v
	rm -f .image.env
