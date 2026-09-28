"""SHACL-validate an RDF graph (e.g. produced by uplift_json.py) against a block's shapes.

pip install bblocks_client[rdf]
"""
from ogc.bblocks.register import load_register
from ogc.bblocks.semantic_uplift import uplift_json
from ogc.bblocks.validate import validate_shacl, ValidationError

register = load_register(
    "https://ogcincubator.github.io/bblocks-examples/build/register.json",
    load_dependencies=False,
)
bblock = register.get_item_summary("ogc.bbr.examples.semantic-uplift.pre-and-post-uplift")

graph = uplift_json(bblock, {"one": 1, "two": 2, "string": "value"})

report = validate_shacl(bblock, graph)
print(report.report)
report.raise_for_invalid()  # raises ValidationError if the graph violates the shapes
