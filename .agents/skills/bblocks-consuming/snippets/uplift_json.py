"""Uplift a JSON payload to RDF using a block's assembled JSON-LD context.

pip install bblocks_client[rdf]
"""
from ogc.bblocks.register import load_register
from ogc.bblocks.semantic_uplift import uplift_json

register = load_register(
    "https://ogcincubator.github.io/bblocks-examples/build/register.json",
    load_dependencies=False,
)
bblock = register.get_item_summary("ogc.bbr.examples.semantic-uplift.pre-and-post-uplift")

sample_data = {"one": 1, "two": 2, "string": "value"}

graph = uplift_json(bblock, sample_data)
print(graph.serialize(format="turtle"))
