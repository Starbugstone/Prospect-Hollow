"""Shared Blender primitives and indexed runtime mesh export for all town asset packs."""
import bpy
import json
import math
from mathutils import Vector

def vec(p):
    return Vector((p[0], -p[2], p[1]))

class AssetPack:
    def __init__(self, root, name, wood='#a37d55', teal='#648d89', green='#91a66e'):
        self.source = root / 'art' / name
        self.output = root / 'src' / 'assets'
        self.source.mkdir(parents=True, exist_ok=True)
        self.output.mkdir(parents=True, exist_ok=True)
        self.wood, self.teal, self.green = wood, teal, green
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        self.materials = {}
        self.models = {}
        self.active = None
        self.joint, self.pivot = 'body', (0, 0, 0)

    def material(self, color):
        if color not in self.materials:
            m = bpy.data.materials.new(color)
            rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
            rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
            m.diffuse_color = (*rgb, 1)
            m.use_nodes = True
            m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
            m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .88
            m['gameColor'] = color
            self.materials[color] = m
        return self.materials[color]

    def model(self, name):
        self.active = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(self.active)
        self.models[name] = self.active
        self.joint, self.pivot = 'body', (0, 0, 0)

    def finish(self, obj, name, color):
        obj.name = name
        obj.parent = self.active
        obj.data.materials.append(self.material(color))
        obj['joint'] = self.joint
        obj['pivot'] = self.pivot
        return obj

    def box(self, name, size, pos, color, bevel=.035):
        bpy.ops.mesh.primitive_cube_add(size=1, location=vec(pos))
        obj = bpy.context.object
        obj.scale = (size[0], size[2], size[1])
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            mod = obj.modifiers.new('Soft timber edges', 'BEVEL')
            mod.width, mod.segments = bevel, 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return self.finish(obj, name, color)

    def ball(self, name, size, pos, color):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=vec(pos))
        obj = bpy.context.object
        obj.scale = (size[0], size[2], size[1])
        for face in obj.data.polygons:
            face.use_smooth = True
        return self.finish(obj, name, color)

    def rod(self, name, start, end, radius, color):
        a, b = vec(start), vec(end)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=(b-a).length, location=(a+b)/2)
        obj = bpy.context.object
        obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
        return self.finish(obj, name, color)

    def loft(self, name, rings, color):
        # A shaped, connected surface; each ring is center X/Y/Z and horizontal/vertical radii.
        vertices, faces = [], []
        for x, y, z, rx, ry in rings:
            for i in range(12):
                a = i * math.tau / 12
                vertices.append(tuple(vec((x + math.cos(a)*rx, y + math.sin(a)*ry, z))))
        for ring in range(len(rings)-1):
            for i in range(12):
                a, b = ring*12+i, ring*12+(i+1)%12
                faces.append((a, b, b+12, a+12))
        faces.extend([tuple(reversed(range(12))), tuple(range((len(rings)-1)*12, len(rings)*12))])
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        for face in mesh.polygons:
            face.use_smooth = True
        return self.finish(obj, name, color)


    def tree(self, x, z):
        self.rod('Branched tree trunk', (x, .08, z), (x, 2.1, z), .12, self.wood)
        for dx, dz in [(-.4, 0), (.4, .25), (0, -.35)]:
            self.rod('Tree branch', (x, 1.2, z), (x+dx, 2.35, z+dz), .07, self.wood)
            self.ball('Soft leaf crown', (.68, .75, .63), (x+dx, 2.55, z+dz), self.green)

    def bench(self, x, z):
        for dx in [-.6, .6]:
            self.rod('Bench legs', (x+dx, .07, z), (x+dx, .72, z), .055, self.teal)
        for dz in [-.16, 0, .16]:
            self.box('Bench seat slat', (1.55, .075, .13), (x, .51, z+dz), self.wood)
        for y in [.77, .94]:
            self.box('Bench back slat', (1.55, .12, .08), (x, y, z-.22), self.wood)

    def export(self, path):
        bpy.context.view_layer.update()
        payload = {'format': 1, 'generator': 'Blender', 'models': {}}
        footprints = {}
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for name, root in self.models.items():
            parts = []
            for obj in root.children:
                evaluated = obj.evaluated_get(depsgraph)
                mesh = evaluated.to_mesh()
                mesh.calc_loop_triangles()
                origin = list(obj['pivot'])
                positions, normals = [], []
                transform = obj.matrix_world
                normal_matrix = transform.to_3x3().inverted().transposed()
                for triangle in mesh.loop_triangles:
                    for index in triangle.vertices:
                        p = transform @ mesh.vertices[index].co
                        normal = mesh.vertices[index].normal if mesh.polygons[triangle.polygon_index].use_smooth else triangle.normal
                        n = (normal_matrix @ normal).normalized()
                        positions.extend(round(v, 5) for v in (p.x-origin[0], p.z-origin[1], -p.y-origin[2]))
                        normals.extend(round(v, 5) for v in (n.x,n.z,-n.y))
                parts.append({'name': obj.name, 'joint': obj['joint'], 'pivot': origin,
                              'color': obj.data.materials[0]['gameColor'], 'positions': positions, 'normals': normals})
                evaluated.to_mesh_clear()
            # Preserve physical components before the render-material merge. Coordinates
            # include each joint pivot and use the same game-space axes as the mesh.
            footprints[name] = []
            for part in parts:
                points = list(zip(*[iter(part['positions'])] * 3))
                if not points:
                    continue
                xs = [p[0] + part['pivot'][0] for p in points]
                ys = [p[1] + part['pivot'][1] for p in points]
                zs = [p[2] + part['pivot'][2] for p in points]
                footprints[name].append({'part': part['name'], 'joint': part['joint'],
                    'yMin': min(ys), 'yMax': max(ys),
                    'rect': [min(xs), min(zs), max(xs), max(zs)]})
            # Join by joint/material, then index shared vertices. This retains animation
            # pivots and eliminates duplicated triangle data and tiny runtime draw calls.
            buckets = {}
            for part in parts:
                key = (part['joint'], part['color'])
                if key not in buckets:
                    buckets[key] = {**part, 'positions': [], 'normals': []}
                buckets[key]['positions'].extend(part['positions'])
                buckets[key]['normals'].extend(part['normals'])
            for part in buckets.values():
                positions, normals, indices, seen = [], [], [], {}
                for i in range(0, len(part['positions']), 3):
                    key = tuple(part['positions'][i:i+3] + part['normals'][i:i+3])
                    if key not in seen:
                        seen[key] = len(positions)//3
                        positions.extend(key[:3])
                        normals.extend(key[3:])
                    indices.append(seen[key])
                part.update(positions=positions, normals=normals, indices=indices)
            payload['models'][name] = list(buckets.values())
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
        path.with_name(path.stem + '-footprints.json').write_text(
            json.dumps(footprints, separators=(',', ':')), encoding='utf-8')
        return payload
