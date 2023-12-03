
let canvas = document.getElementById( 'the-canvas' );
/** @type {WebGLRenderingContext} */
let gl = canvas.getContext( 'webgl2' );

let vertex_source = 
`   #version 300 es
precision mediump float;

uniform mat4 modelview;
uniform vec3 camera_pos;

in vec3 coordinates;
in vec3 normalized_vec;
in vec2 uv;

out vec3 v_normalized_vec;
out vec2 v_uv;
out vec4 v_position;
out vec3 v_camera_pos;


void main( void ) {
    v_camera_pos = normalize(camera_pos);
    v_position = modelview * vec4( coordinates, 1.0 );
    gl_Position = v_position;
    v_normalized_vec = normalized_vec;
    v_uv = uv;
}
`;

let fragment_source = 
`   #version 300 es
precision mediump float;

uniform sampler2D tex_0;
uniform float ambiant_factor;
uniform float diffuse_factor;
uniform float shininess; 
uniform float specular_factor;

in vec3 v_normalized_vec;
in vec2 v_uv;
in vec3 v_camera_pos;

out vec4 f_color;

void main(void) {
    // Lights: two lights one point and one directional
    vec3 sun = vec3(0.0, 0.0, -1.0);

    vec3 point_light_cord = vec3(0.0, -4.0, 0.0);
    vec3 point_light_dir = normalize(point_light_cord);
    float point_light_dist = distance(point_light_cord, gl_FragCoord.xyz);
    float point_light_attinutation = (1.0 / (point_light_dist * point_light_dist))+.6;

    // diffuse
    float directional_light_delta = max(dot(sun, v_normalized_vec),0.0);
    float point_light_delta = max(dot(point_light_dir, v_normalized_vec),0.0);

    vec4 directional_light = vec4(1.0 * directional_light_delta, 1.0 * directional_light_delta, 1.0 * directional_light_delta, 1.0);
    vec4 point_light = vec4(1.0 * point_light_delta, 0.0, 0.0, 1.0)*point_light_attinutation;

    vec4 diffuse = (directional_light + point_light) * diffuse_factor;

    // ambiant
    vec4 ambiant = vec4(ambiant_factor, ambiant_factor, ambiant_factor, 1.0);

    // Specular lighting
    vec3 view_dir = normalize(v_camera_pos);
    vec3 reflection_directional = reflect(-sun, v_normalized_vec);
    vec3 reflection_point = reflect(-point_light_dir, v_normalized_vec);
    float spec_directional_light = pow(max(dot(reflection_directional, view_dir), 0.0), shininess);
    float spec_point_light = pow(max(dot(reflection_point, view_dir), 0.0), shininess);
    vec4 Specular = specular_factor * (spec_directional_light + spec_point_light) * vec4(1.0, 1.0, 1.0, 1.0);

    // Final calculations
    vec4 finalColor = (ambiant + diffuse + Specular) * texture(tex_0, v_uv);
    f_color = clamp(finalColor, 0.0, 1.0);
}

`

function xor_texture() {
    let data = new Array( 256 * 256 * 4 );
    let width = 256;
    for( let row = 0; row < width; row++ ) {
        for( let col = 0; col < width; col++ ) {
            let pix = ( row * width + col ) * 4; // [does this make sense?
            data[pix] = data[pix + 1] = data[pix + 2] = row ^ col;
            data[pix + 3] = 255; // alpha always max (fully opaque)
        }
    }
    let r =  new Uint8Array( data );
    console.log(r);
    return r;
}



let tex = gl.createTexture();
const image = new Image();
image.src = "rocky-mountain-texture-seamless.jpg";
image.onload = function () {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap( gl.TEXTURE_2D );
};

let tex2 = gl.createTexture();
const image2 = new Image();
image2.src = 'grass_lawn_seamless.png';
image2.onload = function () {
  gl.bindTexture(gl.TEXTURE_2D, tex2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image2);
  gl.generateMipmap( gl.TEXTURE_2D );
};

let shader_program = 
create_compile_and_link_program( gl, vertex_source, fragment_source );
gl.useProgram( shader_program );


const AMBIANT_FACTOR = 0.25;
const DIFFUSE_FACTOR = 1.0;
const SPECULAR_FACTOR = 2.0;
const SHININESS = 4.0;
set_uniform_scalar(gl, shader_program, "ambiant_factor", AMBIANT_FACTOR);
set_uniform_scalar(gl, shader_program, "diffuse_factor", DIFFUSE_FACTOR);
set_uniform_scalar(gl, shader_program, "specular_factor", SPECULAR_FACTOR);
set_uniform_scalar(gl, shader_program, "shininess", SHININESS);


set_render_params( gl );

let last_update = performance.now();
const DESIRED_TICK_RATE = 60;
const DESIRED_MSPT = 1000.0 / DESIRED_TICK_RATE;

const ROTATION_SPEED = 0.125; // eighth turn per second
const ROTATION_SPEED_PER_FRAME = ROTATION_SPEED / DESIRED_TICK_RATE;

const FLY_SPEED = 1;    // units per second
const FLY_SPEED_PER_FRAME = FLY_SPEED / DESIRED_TICK_RATE;

let keys = Keys.start_listening();
let cam = new Camera();
cam.translate( 0, 0, -3 );

// let mesh = Mesh.box( gl, shader_program, 3, 3, 1 );
let projection = Mat4.perspective_fovx( 0.25, canvas.width / canvas.height, 0.25, 64 );
let sphere = Mesh.make_uv_sphere(gl, shader_program, 16, 1);

let the_mesh = null;
console.log("before function");
Mesh.from_obj_file(gl, "box.obj", shader_program, mesh_callback);
console.log("after function");

function mesh_callback(loaded_mesh){
    console.log(loaded_mesh);
    the_mesh = loaded_mesh;
}

function render_long_rock(x, y, size){
    gl.bindTexture(gl.TEXTURE_2D, tex);
    let model = Mat4.identity();
    let translation = Mat4.translation(x, y, 0);
    let scale = Mat4.scale(2*size, 1.2*size, 1*size);
    model = model.mul( projection );
    model = model.mul( cam.get_view_matrix() );
    model = model.mul(translation);
    model = model.mul(scale);

    set_uniform_matrix4( 
        gl, shader_program, "modelview", model.data );

    set_uniform_vec3( 
        gl, shader_program, "camera_pos", cam.x, cam.y, cam.z);

    sphere.render(gl);
}

function render_round_rock(x, y, size){
    gl.bindTexture(gl.TEXTURE_2D, tex);
    let model = Mat4.identity();
    let translation = Mat4.translation(x, y, 0);
    let scale = Mat4.scale(size, size, size);
    model = model.mul( projection );
    model = model.mul( cam.get_view_matrix() );
    model = model.mul(translation);
    model = model.mul(scale);

    set_uniform_matrix4( 
        gl, shader_program, "modelview", model.data );

    set_uniform_vec3( 
        gl, shader_program, "camera_pos", cam.x, cam.y, cam.z);

    sphere.render(gl);
}

function render_ground(x, y, size){
    gl.bindTexture(gl.TEXTURE_2D, tex2);
    let model = Mat4.identity();
    let translation = Mat4.translation(x, y, 1);
    let scale = Mat4.scale(size*2, size*2, size);
    model = model.mul( projection );
    model = model.mul( cam.get_view_matrix() );
    model = model.mul(translation);
    model = model.mul(scale);

    set_uniform_matrix4( 
        gl, shader_program, "modelview", model.data );

    set_uniform_vec3( 
        gl, shader_program, "camera_pos", cam.x, cam.y, cam.z);

    the_mesh.render(gl);
}

function render( now ) {
last_update = now;
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    render_round_rock(1, 1, 1);
    render_long_rock(1, 3, 1.3);
    render_long_rock(-2, 0, .7);
    if (the_mesh != null){
        render_ground(0, 0, 1);
        render_ground(0, 4, 1);
        render_ground(0, -4, 1);
        render_ground(4, 0, 1);
        render_ground(4, 4, 1);
        render_ground(4, -4, 1);
        render_ground(-4, 0, 1);
        render_ground(-4, 4, 1);
        render_ground(-4, -4, 1);
    }

    requestAnimationFrame( render );
}

const KEYMAP = {
    'KeyW': function() { cam.move_in_direction( 0, 0, FLY_SPEED_PER_FRAME ); },
    'KeyS': function() { cam.move_in_direction( 0, 0, -FLY_SPEED_PER_FRAME ); },
    'KeyA': function() { cam.move_in_direction( -FLY_SPEED_PER_FRAME, 0, 0 ); },
    'KeyD': function() { cam.move_in_direction( FLY_SPEED_PER_FRAME, 0, 0 ); },
    'Space': function() { cam.translate( 0, FLY_SPEED_PER_FRAME, 0 ); },
    'KeyC': function() { cam.translate( 0, -FLY_SPEED_PER_FRAME, 0 ); },
    'KeyQ': function() { cam.add_roll( -ROTATION_SPEED_PER_FRAME ); },
    'KeyE': function() { cam.add_roll( ROTATION_SPEED_PER_FRAME ); },
    'ArrowLeft': function() { cam.add_yaw( -ROTATION_SPEED_PER_FRAME ); },
    'ArrowRight': function() { cam.add_yaw( ROTATION_SPEED_PER_FRAME ); },
    'ArrowUp': function() { cam.add_pitch( -ROTATION_SPEED_PER_FRAME ); },
    'ArrowDown': function() { cam.add_pitch( ROTATION_SPEED_PER_FRAME ); },
};

function update() {
let keys_down = keys.keys_down_list();

for( const key of keys_down ) {
    let bound_function = KEYMAP[ key ];

    if( bound_function ) {
        bound_function();
    }
}

return;

/* this is another way of doing the key map. 
    but make sure you understand how the key binding approach works!

if( keys.is_key_down( 'KeyW' ) ) {
    cam.move_in_direction( 0, 0, FLY_SPEED_PER_FRAME );
}
if( keys.is_key_down( 'KeyS' ) ) {
    cam.move_in_direction( 0, 0, -FLY_SPEED_PER_FRAME );
}
if( keys.is_key_down( 'KeyA' ) ) {
    cam.move_in_direction( -FLY_SPEED_PER_FRAME, 0, 0 );
}
etc ...
}*/
}
requestAnimationFrame( render );
setInterval( update, DESIRED_MSPT );