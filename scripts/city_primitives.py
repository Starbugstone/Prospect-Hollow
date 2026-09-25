"""Data API authoring avoids quadratic operator scene updates in the city gallery."""
import bpy, bmesh
from mathutils import Vector
from blender_assets import vec

def install_city_primitives(art):
    def object_from_mesh(bm,name,pos,color):
        mesh=bpy.data.meshes.new(name)
        bm.to_mesh(mesh);bm.free();mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        obj.location=vec(pos)
        return art.finish(obj,name,color)
    def box(name,size,pos,color,bevel=.035):
        bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
        for v in bm.verts:v.co.x*=size[0];v.co.y*=size[2];v.co.z*=size[1]
        if bevel:bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=1,affect='EDGES')
        bm.normal_update()
        return object_from_mesh(bm,name,pos,color)
    def ball(name,size,pos,color):
        bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=6,radius=1)
        for v in bm.verts:v.co.x*=size[0];v.co.y*=size[2];v.co.z*=size[1]
        for f in bm.faces:f.smooth=True
        bm.normal_update()
        return object_from_mesh(bm,name,pos,color)
    def rod(name,start,end,radius,color):
        a,b=vec(start),vec(end)
        bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=8,radius1=radius,radius2=radius,depth=(b-a).length)
        bm.normal_update()
        obj=object_from_mesh(bm,name,((start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2),color)
        obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
        return obj
    art.box,art.ball,art.rod=box,ball,rod
