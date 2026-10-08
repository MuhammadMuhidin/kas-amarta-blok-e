.PHONY: build push build-push up down logs clean help

RANDOM_SHA7 := $(shell date +%s%N | sha1sum | cut -c1-7)
IMAGE_NAME := $(RANDOM_SHA7)-kas-amarta
DOCKER_HUB_USER := muhidin
IMAGE_FULL := $(DOCKER_HUB_USER)/kas-amarta:$(RANDOM_SHA7)

# Extract Supabase env vars for build
NEXT_PUBLIC_SUPABASE_URL := $(shell grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d'=' -f2)
NEXT_PUBLIC_SUPABASE_ANON_KEY := $(shell grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env | cut -d'=' -f2)

help:
	@echo "Available targets:"
	@echo "  make build       - Build Docker image locally"
	@echo "  make push        - Push to Docker Hub"
	@echo "  make build-push  - Build and push to Docker Hub"
	@echo "  make up          - Start container (pulls from Docker Hub)"
	@echo "  make down        - Stop container"
	@echo "  make logs        - View container logs"
	@echo "  make clean       - Remove local image and volumes"

build:
	docker builder prune -af
	docker build \
		--build-arg NEXT_PUBLIC_SUPABASE_URL=$(NEXT_PUBLIC_SUPABASE_URL) \
		--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$(NEXT_PUBLIC_SUPABASE_ANON_KEY) \
		-t $(IMAGE_NAME) .
	@echo "Built locally: $(IMAGE_NAME)"

push:
	docker tag $(IMAGE_NAME) $(IMAGE_FULL)
	docker push $(IMAGE_FULL)
	@echo "Pushed to Docker Hub: $(IMAGE_FULL)"
	@echo "DOCKER_IMAGE=$(IMAGE_FULL)" > .image.env

build-push: build push
	@echo "Build and push complete: $(IMAGE_FULL)"

up:
	@if [ -f .image.env ]; then \
		source .image.env; \
		docker compose -f docker-compose.yml up -d; \
	else \
		echo "Error: Image not built/pushed. Run 'make build-push' first."; \
		exit 1; \
	fi

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down -v
	docker rmi $(IMAGE_NAME) || true
	rm -f .image.env
