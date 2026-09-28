"""Load a register and look up a block, using bblocks-client-python.

pip install bblocks_client
"""
from ogc.bblocks.register import load_register

register = load_register("https://ogcincubator.github.io/bblocks-examples/build/register.json")

# Lightweight summary: schema/context URLs, dependsOn, status, etc.
summary = register.get_item_summary("ogc.bbr.examples.observation.vectorObservation")
print(summary.schema)       # {'application/yaml': '...', 'application/json': '...'}
print(summary.ld_context)
print(summary.depends_on)

# Full block: adds inline examples, annotated schema text, semantic uplift steps.
full = register.get_item_full("ogc.bbr.examples.observation.vectorObservation")
print(full.name)
print([ex.snippets for ex in full.examples])
