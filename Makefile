# HEAVY BAGGAGE — developer commands.
# Override the engine path with:  make run GODOT=/path/to/godot
GODOT ?= godot
PROJECT := .

.PHONY: help import run editor test integration validate validate-content \
        validate-localization dedicated export-windows export-linux export-demo \
        release clean

help:
	@echo "HEAVY BAGGAGE make targets:"
	@echo "  make import                - build import cache / global class cache"
	@echo "  make run                   - run the game"
	@echo "  make editor                - open the project in the Godot editor"
	@echo "  make test                  - run the headless unit test suite"
	@echo "  make integration           - run the end-to-end contract integration test"
	@echo "  make validate              - validate content AND localization"
	@echo "  make dedicated             - run a headless host for multiplayer testing"
	@echo "  make export-windows        - export the Windows build to build/windows/"
	@echo "  make export-linux          - export the Linux build to build/linux/"
	@echo "  make export-demo           - export the Demo build to build/demo/"
	@echo "  make release               - export all + zip archives into dist/"

# Building the import + class cache (required after adding class_name scripts).
import:
	$(GODOT) --headless --editor --quit --path $(PROJECT)

run:
	$(GODOT) --path $(PROJECT)

editor:
	$(GODOT) --editor --path $(PROJECT)

test: import
	$(GODOT) --headless --path $(PROJECT) res://tools/test_runner.tscn

integration: import
	$(GODOT) --headless --path $(PROJECT) res://tools/integration_contract.tscn

validate: validate-content validate-localization

validate-content: import
	$(GODOT) --headless --path $(PROJECT) tools/validate_content.tscn

validate-localization: import
	$(GODOT) --headless --path $(PROJECT) tools/validate_localization.tscn

# Headless host for manual multiplayer testing (see docs/MULTIPLAYER.md).
dedicated:
	$(GODOT) --headless --path $(PROJECT) --dev -- --host

export-windows:
	mkdir -p build/windows
	$(GODOT) --headless --path $(PROJECT) --export-release "Windows Desktop" build/windows/HeavyBaggage.exe

export-linux:
	mkdir -p build/linux
	$(GODOT) --headless --path $(PROJECT) --export-release "Linux" build/linux/HeavyBaggage.x86_64

export-demo:
	mkdir -p build/demo
	$(GODOT) --headless --path $(PROJECT) --export-release "Demo (Windows)" build/demo/HeavyBaggage_Demo.exe

release: export-windows export-linux export-demo
	mkdir -p dist
	cd build/windows && zip -r ../../dist/HeavyBaggage-windows.zip . || true
	cd build/linux && zip -r ../../dist/HeavyBaggage-linux.zip . || true
	cd build/demo && zip -r ../../dist/HeavyBaggage-demo.zip . || true

clean:
	rm -rf build dist .godot/imported
