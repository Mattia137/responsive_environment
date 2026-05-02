import os
import glob

for f in glob.glob('js/layers/*.js'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace("state.mode === 'after'", "state.timeStep > 0")
    content = content.replace('state.mode === "after"', "state.timeStep > 0")
    content = content.replace("state.mode === 'before'", "state.timeStep === 0")
    content = content.replace('state.mode === "before"', "state.timeStep === 0")
    content = content.replace("state.mode", "state.timeStep")
    
    # Specifics for construction (timeStep === 1)
    if 'air.js' in f:
        # The plume is ONLY in timeStep 1
        content = content.replace("if (state.timeStep > 0) {", "if (state.timeStep === 1) {", 1) # First occurrence is plume addLayer
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print("Layers patched.")
