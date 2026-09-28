"""Validate a JSON payload against a block's schema, using bblocks-client-python.

pip install bblocks_client[jsonschema]
"""
import json
from ogc.bblocks.register import load_register
from ogc.bblocks.validate import validate_json, ValidationError

register = load_register(
    "https://ogcincubator.github.io/bblocks-examples/build/register.json",
    load_dependencies=False,
)
bblock = register.get_item_summary("ogc.bbr.examples.semantic-uplift.pre-and-post-uplift")

sample_data = json.loads('{"One": 1, "two": 2, "string": "value"}')

report = validate_json(bblock, sample_data)
if not report.valid:
    print(report.exception)

# Or raise directly on invalid data:
sample_data["one"] = sample_data.pop("One")
report = validate_json(bblock, sample_data)
report.raise_for_invalid()  # raises ValidationError if still invalid
