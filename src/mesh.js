
// const VERTEX_STRIDE = 28;
const VERTEX_STRIDE = 32;

class Mesh {
    /** 
     * Creates a new mesh and loads it into video memory.
     * 
     * @param {WebGLRenderingContext} gl  
     * @param {number} program
     * @param {number[]} vertices
     * @param {number[]} indices
    */
    constructor( gl, program, vertices, indices ) {
        this.verts = create_and_load_vertex_buffer( gl, vertices, gl.STATIC_DRAW );
        this.indis = create_and_load_elements_buffer( gl, indices, gl.STATIC_DRAW );

        this.n_verts = vertices.length;
        this.n_indis = indices.length;
        this.program = program;
    }

    /**
     * Create a box mesh with the given dimensions and colors.
     * @param {WebGLRenderingContext} gl 
     * @param {number} width 
     * @param {number} height 
     * @param {number} depth 
     */

    static box( gl, program, width, height, depth ) {
        let hwidth = width / 2.0;
        let hheight = height / 2.0;
        let hdepth = depth / 2.0;

        let verts = [
            // front points
            hwidth, -hheight, -hdepth, 1.0, 0.0, 0.0, 1.0,      0, 1/6, // 0
            -hwidth, -hheight, -hdepth, 0.0, 0.0, 0.0, 1.0,     1, 1/6, // 1
            -hwidth, hheight, -hdepth, 0.0, 1.0, 0.0, 1.0,      1, 0, // 2
            hwidth, hheight, -hdepth, 1.0, 1.0, 0.0, 1.0,       0, 0, // 3
        
            // back points
            hwidth, -hheight, hdepth, 1.0, 0.0, 0.0, 1.0,       1, 2/6, // 4
            -hwidth, -hheight, hdepth, 0.0, 0.0, 0.0, 1.0,      0, 2/6, // 5
            -hwidth, hheight, hdepth, 0.0, 1.0, 0.0, 1.0,       0, 1/6, // 6
            hwidth, hheight, hdepth, 1.0, 1.0, 0.0, 1.0,        1, 1/6, // 7

            // right points
            hwidth, -hheight, -hdepth, 1.0, 0.0, 0.0, 1.0,      0, 3/6, // 8: 0 
            hwidth, hheight, -hdepth, 1.0, 1.0, 0.0, 1.0,       0, 2/6, // 9: 3
            hwidth, -hheight, hdepth, 1.0, 0.0, 0.0, 1.0,       1, 3/6, // 10: 4
            hwidth, hheight, hdepth, 1.0, 1.0, 0.0, 1.0,        1, 2/6, // 11: 7

            // left points
            -hwidth, -hheight, -hdepth, 0.0, 0.0, 0.0, 1.0,     1, 4/6, // 12: 1  
            -hwidth, hheight, -hdepth, 0.0, 1.0, 0.0, 1.0,      1, 3/6, // 13: 2
            -hwidth, -hheight, hdepth, 0.0, 0.0, 0.0, 1.0,      0, 4/6, // 14: 5
            -hwidth, hheight, hdepth, 0.0, 1.0, 0.0, 1.0,       0, 3/6, // 15 :6

            // top points
            -hwidth, hheight, -hdepth, 0.0, 1.0, 0.0, 1.0,      1, 4/6, // 16: 2
            hwidth, hheight, -hdepth, 1.0, 1.0, 0.0, 1.0,       0, 4/6, // 17: 3
            -hwidth, hheight, hdepth, 0.0, 1.0, 0.0, 1.0,       0, 5/6, // 18: 6
            hwidth, hheight, hdepth, 1.0, 1.0, 0.0, 1.0,        1, 5/6, // 19: 7

            // bot points
            -hwidth, -hheight, -hdepth, 0.0, 0.0, 0.0, 1.0,      0, 1/6, // 20: 0
            hwidth, -hheight, -hdepth, 0.0, 0.0, 0.0, 1.0,       1, 1/6, // 21: 1
            -hwidth, -hheight, hdepth, 0.0, 0.0, 0.0, 1.0,       1, 0, // 22: 4
            hwidth, -hheight, hdepth, 0.0, 0.0, 0.0, 1.0,        0, 0 // 23: 5
        ];
        

        let indis = [
            // clockwise winding
            /*
            0, 1, 2, 2, 3, 0,
            4, 0, 3, 3, 7, 4, 
            5, 4, 7, 7, 6, 5, 
            1, 5, 6, 6, 2, 1,
            3, 2, 6, 6, 7, 3,
            4, 5, 1, 1, 0, 4,
            */

            // counter-clockwise winding
            0, 3, 2, 2, 1, 0, // front : done
            10, 11, 9, 9, 8, 10, // right: done
            5, 6, 7, 7, 4, 5, // back : done
            12, 13, 15, 15, 14, 12, // left : done
            17, 19, 18, 18, 16, 17, // top : done
            23, 21, 20, 20, 22, 23, // bottom : done
        ];

        return new Mesh( gl, program, verts, indis );
    }

    static make_uv_sphere(gl, program, subdivs, material) {
        let verts = [];
        let indis = [];
        const RADIUS = 1.0; 
        const TAU = Math.PI * 2;
        for (let layer = 0; layer <= subdivs; layer++) {
            let layer_difference = (layer / subdivs) * Math.PI;
            let y = Math.cos(layer_difference) * RADIUS;
            for (let subdiv = 0; subdiv <= subdivs; subdiv++) {
                let subdiv_difference = (subdiv / subdivs) * TAU; 
                let x = Math.cos(subdiv_difference) * Math.sin(layer_difference) * RADIUS;
                let z = Math.sin(subdiv_difference) * Math.sin(layer_difference) * RADIUS;
                let normalized = new Vec4(x, y, z).norm();
                let u = subdiv_difference / (2 * Math.PI);
                let v = layer_difference / Math.PI;
                verts.push(x, y, z, normalized.x, normalized.y, normalized.z, u, v);
                if (layer <= subdivs) {
                    let current_layer = layer * subdivs + subdiv;
                    let next_layer = (layer + 1) * subdivs + subdiv;
                    indis.push(current_layer, next_layer, next_layer + 1);
                    indis.push(current_layer, next_layer + 1, current_layer + 1);
                }
            }
        }
        return new Mesh( gl, program, verts, indis );
    }
    


    /**
     * Render the mesh. Does NOT preserve array/index buffer or program bindings! 
     * 
     * @param {WebGLRenderingContext} gl 
     */
    render( gl ) {
        gl.cullFace( gl.BACK );
        gl.enable( gl.CULL_FACE );
        
        gl.useProgram( this.program );
        gl.bindBuffer( gl.ARRAY_BUFFER, this.verts );
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.indis );

        set_vertex_attrib_to_buffer( 
            gl, this.program, 
            "coordinates", 
            this.verts, 3, 
            gl.FLOAT, false, VERTEX_STRIDE, 0 
        );

        set_vertex_attrib_to_buffer( 
            gl, this.program, 
            "normalized_vec", 
            this.verts, 3, 
            gl.FLOAT, false, VERTEX_STRIDE, 12
        );

        set_vertex_attrib_to_buffer( 
            gl, this.program, 
            "uv", 
            this.verts, 2, 
            gl.FLOAT, false, VERTEX_STRIDE, 24
        );

        // set_vertex_attrib_to_buffer( 
        //     gl, this.program, 
        //     "normlz", 
        //     this.verts, 3, 
        //     gl.FLOAT, false, VERTEX_STRIDE, 36
        // );

        gl.drawElements( gl.TRIANGLES, this.n_indis, gl.UNSIGNED_SHORT, 0 );
    }

    /**
     * Parse the given text as the body of an obj file.
     * @param {WebGLRenderingContext} gl
     * @param {WebGLProgram} program
     * @param {string} text
     */
    static from_obj_text( gl, program, text ) {
        console.log("top");
        let lines = text.split( /\r?\n/ );

        let verts = [];
        let indis = [];
        

        for( let line of lines ) {
            let trimmed = line.trim();
            let parts = trimmed.split( /(\s+)/ );

            if( 
                parts === null || parts.length < 2 || 
                parts[0] == '#' || parts[0] === '' ) 
            { 
                continue; 
            }
            else if( parts[0] == 'v' ) {
                let x = parts[2];
                let y = parts[4];
                let z = parts[6];
                let normalized = new Vec4(x, y, z).norm();
                verts.push( parseFloat( x ) );
                verts.push( parseFloat( y ) );
                verts.push( parseFloat( z ) );
                verts.push(normalized.x, normalized.y, normalized.z);
                verts.push(parts[8], parts[10]);
                
            }
            else if( parts[0] == 'f' ) {
                indis.push( parseInt( parts[2] ));
                indis.push( parseInt( parts[4] ));
                indis.push( parseInt( parts[6] ));
            }
            else {
                console.log( parts) ;
                throw new Error( 'unsupported obj command: ', parts[0], parts );
            }
        }
		
		console.log("got here" );
        
        return new Mesh( gl, program, verts, indis );
    }

    /**
     * Asynchronously load the obj file as a mesh.
     * @param {WebGLRenderingContext} gl
     * @param {string} file_name 
     * @param {WebGLProgram} program
     * @param {function} f the function to call and give mesh to when finished.
     */
    static from_obj_file( gl, file_name, program, f ) {
        let request = new XMLHttpRequest();
        
        // the function that will be called when the file is being loaded
        request.onreadystatechange = function() {
            // console.log( request.readyState );

            if( request.readyState != 4 ) { return; }
            if( request.status != 200 ) { 
                throw new Error( 'HTTP error when opening .obj file: ', request.statusText ); 
            }

            // now we know the file exists and is ready
            let loaded_mesh = Mesh.from_obj_text( gl, program, request.responseText );

            console.log( 'loaded ', file_name );
            f( loaded_mesh );
        };

        
        request.open( 'GET', file_name ); // initialize request. 
        request.send();                   // execute request
    }
}