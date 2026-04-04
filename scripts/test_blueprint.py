"""Tests for scripts/blueprint.py — run with: python scripts/test_blueprint.py"""

import os
import subprocess
import sys
import tempfile

SCRIPT = os.path.join(os.path.dirname(__file__), "blueprint.py")


def run(args, cwd):
    """Run blueprint.py with given args in cwd; return CompletedProcess."""
    return subprocess.run(
        [sys.executable, SCRIPT] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
    )


def setup_bdd_dir(tmpdir):
    """Create the .storyline dir that init expects to be able to write into."""
    os.makedirs(os.path.join(tmpdir, ".storyline"), exist_ok=True)


# ---------------------------------------------------------------------------
# Test 1: init creates a valid blueprint
# ---------------------------------------------------------------------------
def test_init_creates_valid_blueprint():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)

        result = run(["init", "--project", "Test App"], cwd=tmpdir)
        assert result.returncode == 0, (
            f"init failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        blueprint_path = os.path.join(tmpdir, ".storyline", "blueprint.yaml")
        assert os.path.exists(blueprint_path), "blueprint.yaml was not created"

        validate = run(["validate"], cwd=tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after init:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_init_creates_valid_blueprint")


# ---------------------------------------------------------------------------
# Test 2: init refuses if blueprint already exists
# ---------------------------------------------------------------------------
def test_init_refuses_if_blueprint_exists():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)

        run(["init", "--project", "Test App"], cwd=tmpdir)
        result = run(["init", "--project", "Test App"], cwd=tmpdir)

        assert result.returncode != 0, "Second init should have failed but returned 0"
        assert "already exists" in result.stderr.lower() or "already exists" in result.stdout.lower(), (
            f"Expected 'already exists' in output.\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

    print("PASS test_init_refuses_if_blueprint_exists")


# ---------------------------------------------------------------------------
# Test 3: validate empty (freshly initialised) blueprint passes
# ---------------------------------------------------------------------------
def test_validate_empty_blueprint_passes():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], cwd=tmpdir)

        result = run(["validate"], cwd=tmpdir)
        assert result.returncode == 0, (
            f"validate should pass on fresh blueprint:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_empty_blueprint_passes")


# ---------------------------------------------------------------------------
# Test 4: validate fails when meta.project is missing
# ---------------------------------------------------------------------------
def test_validate_missing_meta_project_fails():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], cwd=tmpdir)

        blueprint_path = os.path.join(tmpdir, ".storyline", "blueprint.yaml")

        # Replace the file with one that has no meta.project
        bad_yaml = (
            "meta:\n"
            "  created_at: '2026-01-01'\n"
            "  updated_at: '2026-01-01'\n"
            "  version: 1\n"
            "tech_stack: {}\n"
            "bounded_contexts: []\n"
            "glossary: {}\n"
            "gaps: []\n"
            "questions: []\n"
        )
        with open(blueprint_path, "w") as f:
            f.write(bad_yaml)

        result = run(["validate"], cwd=tmpdir)
        assert result.returncode != 0, "validate should fail when meta.project is missing"
        assert "meta.project" in result.stderr, (
            f"Expected 'meta.project' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_missing_meta_project_fails")


# ---------------------------------------------------------------------------
# Test 5: validate fails when unknown top-level key is present
# ---------------------------------------------------------------------------
def test_validate_unknown_top_level_key_fails():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], cwd=tmpdir)

        blueprint_path = os.path.join(tmpdir, ".storyline", "blueprint.yaml")

        with open(blueprint_path, "a") as f:
            f.write("\nfoo: bar\n")

        result = run(["validate"], cwd=tmpdir)
        assert result.returncode != 0, "validate should fail on unknown top-level key"
        assert "foo" in result.stderr, (
            f"Expected 'foo' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_unknown_top_level_key_fails")


# ---------------------------------------------------------------------------
# Helper: write a blueprint YAML to the canonical path inside tmpdir
# ---------------------------------------------------------------------------
def write_blueprint(tmpdir, yaml_content):
    bdd_dir = os.path.join(tmpdir, ".storyline")
    os.makedirs(bdd_dir, exist_ok=True)
    features_dir = os.path.join(bdd_dir, "features")
    os.makedirs(features_dir, exist_ok=True)
    blueprint_path = os.path.join(bdd_dir, "blueprint.yaml")
    with open(blueprint_path, "w") as f:
        f.write(yaml_content)
    return blueprint_path, features_dir



# ---------------------------------------------------------------------------
# Test 6: validate fails when a feature file referenced by a command is missing
# ---------------------------------------------------------------------------
def test_validate_feature_file_not_found():
    with tempfile.TemporaryDirectory() as tmpdir:
        yaml_content = (
            "meta:\n"
            "  project: 'Test App'\n"
            "  created_at: '2026-01-01'\n"
            "  updated_at: '2026-01-01'\n"
            "  version: 1\n"
            "bounded_contexts:\n"
            "  - name: Ordering\n"
            "    aggregates:\n"
            "      - name: Order\n"
            "        commands:\n"
            "          - name: PlaceOrder\n"
            "            feature_files:\n"
            "              - nonexistent.feature\n"
            "        events: []\n"
            "        policies: []\n"
            "    relationships: []\n"
            "    read_models: []\n"
        )
        write_blueprint(tmpdir, yaml_content)

        result = run(["validate"], tmpdir)
        assert result.returncode != 0, "validate should fail when feature file is missing"
        assert "nonexistent.feature" in result.stderr, (
            f"Expected 'nonexistent.feature' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_feature_file_not_found")


# ---------------------------------------------------------------------------
# Test 7: validate fails when a policy references a non-existent event
# ---------------------------------------------------------------------------
def test_validate_policy_references_missing_event():
    with tempfile.TemporaryDirectory() as tmpdir:
        yaml_content = (
            "meta:\n"
            "  project: 'Test App'\n"
            "  created_at: '2026-01-01'\n"
            "  updated_at: '2026-01-01'\n"
            "  version: 1\n"
            "bounded_contexts:\n"
            "  - name: Ordering\n"
            "    aggregates:\n"
            "      - name: Order\n"
            "        commands:\n"
            "          - name: PlaceOrder\n"
            "            feature_files: []\n"
            "        events:\n"
            "          - name: OrderPlaced\n"
            "            payload_fields: []\n"
            "    policies:\n"
            "      - name: NotifyOnUnknownEvent\n"
            "        triggered_by: 'NonExistentEvent'\n"
            "        issues_command: 'PlaceOrder'\n"
            "    relationships: []\n"
            "    read_models: []\n"
        )
        write_blueprint(tmpdir, yaml_content)

        result = run(["validate"], tmpdir)
        assert result.returncode != 0, "validate should fail when policy references missing event"
        assert "NonExistentEvent" in result.stderr, (
            f"Expected 'NonExistentEvent' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_policy_references_missing_event")


# ---------------------------------------------------------------------------
# Test 8: validate fails when relationship target is a non-existent context
# ---------------------------------------------------------------------------
def test_validate_relationship_references_missing_context():
    with tempfile.TemporaryDirectory() as tmpdir:
        yaml_content = (
            "meta:\n"
            "  project: 'Test App'\n"
            "  created_at: '2026-01-01'\n"
            "  updated_at: '2026-01-01'\n"
            "  version: 1\n"
            "bounded_contexts:\n"
            "  - name: Ordering\n"
            "    aggregates: []\n"
            "    relationships:\n"
            "      - type: customer-supplier\n"
            "        target: NonExistentContext\n"
            "    read_models: []\n"
        )
        write_blueprint(tmpdir, yaml_content)

        result = run(["validate"], tmpdir)
        assert result.returncode != 0, "validate should fail when relationship target context does not exist"
        assert "NonExistentContext" in result.stderr, (
            f"Expected 'NonExistentContext' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_relationship_references_missing_context")


# ---------------------------------------------------------------------------
# Test 9: validate fails when gap affects a non-existent context
# ---------------------------------------------------------------------------
def test_validate_gap_affects_missing_context():
    with tempfile.TemporaryDirectory() as tmpdir:
        yaml_content = (
            "meta:\n"
            "  project: 'Test App'\n"
            "  created_at: '2026-01-01'\n"
            "  updated_at: '2026-01-01'\n"
            "  version: 1\n"
            "bounded_contexts:\n"
            "  - name: Ordering\n"
            "    aggregates: []\n"
            "    relationships: []\n"
            "    read_models: []\n"
            "gaps:\n"
            "  - id: GAP-001\n"
            "    description: A gap referencing a fake context\n"
            "    severity: important\n"
            "    affects:\n"
            "      - FakeContext\n"
        )
        write_blueprint(tmpdir, yaml_content)

        result = run(["validate"], tmpdir)
        assert result.returncode != 0, "validate should fail when gap affects a missing context"
        assert "FakeContext" in result.stderr, (
            f"Expected 'FakeContext' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_gap_affects_missing_context")


# ---------------------------------------------------------------------------
# Test 10: validate passes for a complete valid blueprint with real feature file
# ---------------------------------------------------------------------------
def test_validate_valid_full_blueprint_passes():
    with tempfile.TemporaryDirectory() as tmpdir:
        _, features_dir = write_blueprint(tmpdir, "")  # creates dirs

        # Create the actual feature file on disk
        with open(os.path.join(features_dir, "place_order.feature"), "w") as f:
            f.write("Feature: Place Order\n")

        yaml_content = (
            "meta:\n"
            "  project: 'Full App'\n"
            "  created_at: '2026-01-01'\n"
            "  updated_at: '2026-01-01'\n"
            "  version: 1\n"
            "bounded_contexts:\n"
            "  - name: Ordering\n"
            "    aggregates:\n"
            "      - name: Order\n"
            "        commands:\n"
            "          - name: PlaceOrder\n"
            "            feature_files:\n"
            "              - place_order.feature\n"
            "        events:\n"
            "          - name: OrderPlaced\n"
            "            payload_fields: []\n"
            "    policies:\n"
            "      - name: NotifyOnOrder\n"
            "        triggered_by: 'OrderPlaced'\n"
            "        issues_command: 'PlaceOrder'\n"
            "    relationships:\n"
            "      - type: customer-supplier\n"
            "        target: Ordering\n"
            "    read_models:\n"
            "      - name: OrderSummary\n"
            "        built_from:\n"
            "          - OrderPlaced\n"
            "  - name: Inventory\n"
            "    aggregates: []\n"
            "    relationships: []\n"
            "    read_models: []\n"
            "gaps:\n"
            "  - id: GAP-001\n"
            "    description: Needs more coverage\n"
            "    severity: important\n"
            "    affects:\n"
            "      - Ordering\n"
            "questions:\n"
            "  - id: Q-001\n"
            "    question: Is ordering ready?\n"
            "    severity: critical\n"
            "    affects:\n"
            "      - Ordering\n"
            "    status: open\n"
            "glossary:\n"
            "  Order:\n"
            "    definitions:\n"
            "      - context: Ordering\n"
            "        meaning: A customer order\n"
        )
        # overwrite blueprint with full content
        blueprint_path = os.path.join(tmpdir, ".storyline", "blueprint.yaml")
        with open(blueprint_path, "w") as f:
            f.write(yaml_content)

        result = run(["validate"], tmpdir)
        assert result.returncode == 0, (
            f"validate should pass for a complete valid blueprint.\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

    print("PASS test_validate_valid_full_blueprint_passes")


# ---------------------------------------------------------------------------
# Test 11: add-context adds a context and validate passes
# ---------------------------------------------------------------------------
def test_add_context():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)

        result = run(["add-context", "Payment"], tmpdir)
        assert result.returncode == 0, (
            f"add-context failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-context:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

        import yaml
        blueprint_path = os.path.join(tmpdir, ".storyline", "blueprint.yaml")
        with open(blueprint_path) as f:
            data = yaml.safe_load(f)
        names = [ctx["name"] for ctx in data.get("bounded_contexts", [])]
        assert "Payment" in names, f"Expected 'Payment' in bounded_contexts, got: {names}"

    print("PASS test_add_context")


# ---------------------------------------------------------------------------
# Test 12: add-context duplicate fails with "already exists"
# ---------------------------------------------------------------------------
def test_add_context_duplicate_fails():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)

        result = run(["add-context", "Payment"], tmpdir)
        assert result.returncode != 0, "Second add-context should have failed"
        assert "already exists" in result.stderr.lower(), (
            f"Expected 'already exists' in stderr.\nSTDERR: {result.stderr}"
        )

    print("PASS test_add_context_duplicate_fails")


# ---------------------------------------------------------------------------
# Test 13: add-aggregate adds an aggregate and validate passes
# ---------------------------------------------------------------------------
def test_add_aggregate():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)

        result = run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], tmpdir)
        assert result.returncode == 0, (
            f"add-aggregate failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-aggregate:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_add_aggregate")


# ---------------------------------------------------------------------------
# Test 14: add-event adds an event and validate passes
# ---------------------------------------------------------------------------
def test_add_event():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)
        run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], tmpdir)

        result = run(
            ["add-event", "--context", "Payment", "--aggregate", "Invoice",
             "--name", "InvoiceSent", "--payload", "invoiceId,amount"],
            tmpdir,
        )
        assert result.returncode == 0, (
            f"add-event failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-event:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_add_event")


# ---------------------------------------------------------------------------
# Test 15: add-command adds a command and validate passes
# ---------------------------------------------------------------------------
def test_add_command():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)
        run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], tmpdir)

        # Create the feature file on disk
        features_dir = os.path.join(tmpdir, ".storyline", "features")
        os.makedirs(features_dir, exist_ok=True)
        with open(os.path.join(features_dir, "invoicing.feature"), "w") as f:
            f.write("Feature: Invoicing\n")

        result = run(
            ["add-command", "--context", "Payment", "--aggregate", "Invoice",
             "--name", "SendInvoice", "--feature-files", "invoicing.feature"],
            tmpdir,
        )
        assert result.returncode == 0, (
            f"add-command failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-command:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_add_command")


# ---------------------------------------------------------------------------
# Test 16: add-glossary adds a glossary term and validate passes
# ---------------------------------------------------------------------------
def test_add_glossary():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)

        result = run(
            ["add-glossary", "--term", "Invoice", "--context", "Payment",
             "--meaning", "A request for payment"],
            tmpdir,
        )
        assert result.returncode == 0, (
            f"add-glossary failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-glossary:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_add_glossary")


# ---------------------------------------------------------------------------
# Test 17: add-gap adds a gap and validate passes
# ---------------------------------------------------------------------------
def test_add_gap():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)

        result = run(
            ["add-gap", "--description", "Missing tests",
             "--severity", "important", "--affects", "Payment"],
            tmpdir,
        )
        assert result.returncode == 0, (
            f"add-gap failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-gap:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_add_gap")


# ---------------------------------------------------------------------------
# Test 18: add-question adds a question and validate passes
# ---------------------------------------------------------------------------
def test_add_question():
    with tempfile.TemporaryDirectory() as tmpdir:
        setup_bdd_dir(tmpdir)
        run(["init", "--project", "Test App"], tmpdir)
        run(["add-context", "Payment"], tmpdir)

        result = run(
            ["add-question", "--question", "How do refunds work?",
             "--severity", "important", "--raised-during", "Three Amigos",
             "--affects", "Payment"],
            tmpdir,
        )
        assert result.returncode == 0, (
            f"add-question failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        validate = run(["validate"], tmpdir)
        assert validate.returncode == 0, (
            f"validate failed after add-question:\nSTDOUT: {validate.stdout}\nSTDERR: {validate.stderr}"
        )

    print("PASS test_add_question")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    tests = [
        test_init_creates_valid_blueprint,
        test_init_refuses_if_blueprint_exists,
        test_validate_empty_blueprint_passes,
        test_validate_missing_meta_project_fails,
        test_validate_unknown_top_level_key_fails,
        test_validate_feature_file_not_found,
        test_validate_policy_references_missing_event,
        test_validate_relationship_references_missing_context,
        test_validate_gap_affects_missing_context,
        test_validate_valid_full_blueprint_passes,
        test_add_context,
        test_add_context_duplicate_fails,
        test_add_aggregate,
        test_add_event,
        test_add_command,
        test_add_glossary,
        test_add_gap,
        test_add_question,
    ]

    failed = []
    for test in tests:
        try:
            test()
        except AssertionError as exc:
            print(f"FAIL {test.__name__}: {exc}")
            failed.append(test.__name__)
        except Exception as exc:
            print(f"ERROR {test.__name__}: {exc}")
            failed.append(test.__name__)

    if failed:
        print(f"\n{len(failed)} test(s) failed: {', '.join(failed)}")
        sys.exit(1)
    else:
        print("\nAll tests passed!")
