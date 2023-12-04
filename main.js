let canvas = document.getElementById( 'the-canvas' );
/** @type {WebGLRenderingContext} */
let gl = canvas.getContext( 'webgl2' );

const GOURAUD_VERTEX_SHADER = 
`   #version 300 es
    precision mediump float;

    uniform mat4 projection;
    uniform mat4 modelview;
    uniform mat4 model;
    uniform mat4 view;
    uniform vec3 viewer_loc;

    uniform vec3 sun_dir;
    uniform vec3 sun_color;
    
    uniform vec3 light1_loc;
    uniform vec3 light1_color;

    const float light_attenuation_k = 0.01;
    const float light_attenuation_l = 0.1;
    const float light_attenuation_q = 0.00; /* no quadratic term for now */

    uniform float mat_ambient;
    uniform float mat_diffuse;
    uniform float mat_specular;
    uniform float mat_shininess;

    in vec3 coordinates;
    in vec4 color;
    in vec2 uv;
    in vec3 surf_normal;

    out vec4 v_color;
    out vec2 v_uv;

    vec3 diff_color( 
        vec3 normal, 
        vec3 light_dir,
        vec3 light_color, 
        float mat_diffuse 
    ) {
        return mat_diffuse * light_color * max( dot( normal, light_dir ), 0.0 );
    }

    vec3 spec_color( 
        vec3 normal, 
        vec3 light_dir,
        vec3 eye_dir, 
        vec3 light_color, 
        float mat_specular,
        float mat_shiniess
    ) {
        float cos_light_surf_normal = dot( normal, light_dir );

        if( cos_light_surf_normal <= 0.0 ) {
            return vec3( 0.0, 0.0, 0.0 );
        }

        vec3 light_reflection = 
            2.0 * cos_light_surf_normal * normal - light_dir;

        return 
            pow( 
                max( dot( light_reflection, normalize( eye_dir ) ), 0.0  ),
                mat_shininess 
            ) * light_color * mat_specular;
    }

    float attenuation( vec3 vector_to_light ) {
        float light1_dist = length( vector_to_light );
        float light1_atten = 1.0 / ( 
            light_attenuation_k + 
            light_attenuation_l * light1_dist +
            light_attenuation_q * light1_dist * light1_dist
        );

        return light1_atten;
    }

    void main( void ) {
        vec3 normal_tx = normalize( mat3( model ) * surf_normal );
        vec3 coords_tx = ( model * vec4( coordinates, 1.0 ) ).xyz;

        gl_Position = projection * modelview * vec4( coordinates, 1.0 );
        vec3 eye_dir = normalize( viewer_loc - coords_tx );

        vec4 ambient_color = vec4( mat_ambient, mat_ambient, mat_ambient, 1.0 );

        // vec3 sun_dir_tx = 
        float cos_sun_dir_surf_normal = dot( sun_dir, normal_tx );
        vec3 sun_diffuse_color = diff_color( normal_tx, sun_dir, sun_color, mat_diffuse );
        
        vec3 sun_spec_color =
            spec_color( normal_tx, sun_dir, eye_dir, sun_color, mat_specular, mat_shininess );

        vec4 color_from_sun = vec4( sun_diffuse_color + sun_spec_color, 1.0 );

        vec3 vector_to_light1 = light1_loc - coords_tx;
        vec3 light1_dir = normalize( vector_to_light1 );
        float light1_atten = attenuation( vector_to_light1 );
    
        vec3 light1_diffuse_color = diff_color( 
            normal_tx, light1_dir, light1_color, mat_diffuse);
        vec3 light1_spec_color = spec_color( 
            normal_tx, light1_dir, eye_dir, light1_color, mat_specular, mat_shininess );
        vec4 color_from_light1 = vec4(
                ( light1_diffuse_color + light1_spec_color ) * light1_atten, 1.0 );

        /* multiply color by 0 to remove it. try changing the 0 to a small number like .2
        and the 1 to the complement of that number (1 - .2 = .8) to see how color blending works.*/
        v_color = 
            ( 0.0 * color ) + 
            ( 1.0 * (
                ambient_color +
                color_from_sun +
                color_from_light1
            ) );
        v_uv = uv;
    }
`;

const GOURAUD_FRAGMENT_SHADER = 
`   #version 300 es
    precision mediump float;

    in vec4 v_color;
    in vec2 v_uv;

    out vec4 f_color;

    uniform sampler2D tex_0;

    void main( void ) {
        f_color = v_color * texture( tex_0, v_uv ); 

        /* we can test depth values with this.
        f_color = vec4(vec3(gl_FragCoord.z), 1.0); */
    }
`;

let lit_program = 
    create_compile_and_link_program( 
        gl, 
        /*PHONG_VERTEX_SHADER,*/ GOURAUD_VERTEX_SHADER,
        /*PHONG_FRAGMENT_SHADER,*/ GOURAUD_FRAGMENT_SHADER
    );

gl.useProgram( lit_program );

set_render_params( gl );

let last_update = performance.now();

const DESIRED_TICK_RATE = 60;
const DESIRED_MSPT = 1000.0 / DESIRED_TICK_RATE;

const ROTATION_SPEED = 0.2; // eighth turn per second
const ROTATION_SPEED_PER_FRAME = ROTATION_SPEED / DESIRED_TICK_RATE;

const FLY_SPEED = 1.5;    // units per second
const FLY_SPEED_PER_FRAME = FLY_SPEED / DESIRED_TICK_RATE;

let keys = Keys.start_listening();
let cam = new Camera();
cam.translate( 0, 0, -10 );


let rock_texture = 
    new LitMaterial( gl, 'rock.jpg', gl.LINEAR, 0.25, 1, 2, 5 );
let grass_texture = 
    new LitMaterial( gl, 'perf-grass2.jpg', gl.LINEAR, 0.2, 0.8, 0.05, 1.0 );
let scale = 
    new LitMaterial( gl, 'metal_scale.png', gl.LINEAR, 0.25, 1, 2, 4 );

let sun_dir = ( new Vec4( 1.0, 0.0, -1.0, 0.0 ) ).norm();
let sun = new Light( sun_dir.x, sun_dir.y, sun_dir.z, 1.0, 0.95, 0.85, 0 );
let light1 = new Light( -9, -9, 0.0, 1.0, 0.2, 0.2, 1 );

let rock = NormalMesh.uv_sphere( gl, lit_program, 1, 16, rock_texture ); 
let ground = NormalMesh.box( gl, lit_program, 1, 1, 1, grass_texture );
let tank_body = NormalMesh.box( gl, lit_program, 1, 1, 1, scale );
let tank_cockpit = NormalMesh.uv_sphere( gl, lit_program, 1, 16, scale );


let projection = Mat4.perspective_fovx( 0.125, canvas.width / canvas.height, 0.125, 1024 );
let current_program = lit_program;


function set_and_bind(model){
    let view = cam.get_view_matrix();
    let modelview = view.mul( model );
    
    set_uniform_matrix4( gl, current_program, 'projection', projection.data );
    set_uniform_matrix4( gl, current_program, 'modelview', modelview.data );
    set_uniform_matrix4( gl, current_program, 'model', model.data );
    set_uniform_matrix4( gl, current_program, 'view', view.data );

    // transform viewer coordinates
    // let viewer_loc = cam.get_transformed_coordinates();
    set_uniform_vec3( gl, current_program, 'viewer_loc', cam.x, cam.y, cam.z );

    // bind lights
    sun.bind( gl, current_program, modelview );
    light1.bind( gl, current_program, modelview );

}

const SPHERE_SCALE_Z = 1; // maybe this should vary too
const SPHERE_TRANSLATION_Z = 0;
function render_sphere(x, y, size_x, size_y, roation_turns){
    // we're using world-space lighting, so it's okay to combine projection 
    // and model-view like this.
    let scale_matrix = Mat4.scale(size_x, size_y, SPHERE_SCALE_Z);
    let rotation_matrix = Mat4.rotation_xy(roation_turns);
    let translation_matrix = Mat4.translation(x, y, SPHERE_TRANSLATION_Z );
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    rock.render( gl );
}

const GROUND_SCALE_XY = 10; // x, y
const GROUND_SCALE_Z = 1; // z
const GROUND_TRANSLATION_Z = 0;
function render_ground(x, y){
    let scale_matrix = Mat4.scale(GROUND_SCALE_XY, GROUND_SCALE_XY, GROUND_SCALE_Z);
    let rotation_matrix = Mat4.rotation_xy(0.0);
    let translation_matrix = Mat4.translation(x, y, GROUND_TRANSLATION_Z );
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    ground.render( gl );
}

const TANK_SCALE_X = .2;
const TNAK_SCALE_Y = .35;
const TANK_SCALE_Z = 1;
const TANK_TRANSLATION_Z = -.12;
function render_tank_body(x, y){
    let scale_matrix = Mat4.scale(TANK_SCALE_X, TNAK_SCALE_Y, TANK_SCALE_Z);
    let rotation_matrix = Mat4.rotation_xy(0.0);
    let translation_matrix = Mat4.translation(x, y, TANK_TRANSLATION_Z );
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    tank_body.render( gl );
}

const COCKPIT_SCALE_X = .075;
const COCKPIT_SCALE_Y = .075;
const COCKPIT_SCALE_Z = 1;
const COCKPIT_TRANSLATION_Z = -.12;
function render_tank_cockpit(x, y){
    let scale_matrix = Mat4.scale(COCKPIT_SCALE_X, COCKPIT_SCALE_Y, COCKPIT_SCALE_Z);
    let rotation_matrix = Mat4.rotation_xy(0.0);
    let translation_matrix = Mat4.translation(x, y, COCKPIT_TRANSLATION_Z );
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    tank_cockpit.render( gl );
}

const BARREL_SCALE_X = .05;
const BARREL_SCALE_Y = .3;
const BARREL_SCALE_Z = 1;
const BARREL_TRANSLATION_Z = -.12;
function redner_tank_barrel(x, y, rotation_deg){
    let scale_matrix = Mat4.scale(BARREL_SCALE_X, BARREL_SCALE_Y, BARREL_SCALE_Z);

    // var angle_rad = rotation_deg * Math.PI / 180;

    let rotation_matrix = Mat4.rotation_xy(convertDegreesToNormalizedValue(-rotation_deg));
    let translation_matrix = Mat4.translation(x, y, BARREL_TRANSLATION_Z);
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    tank_body.render( gl );
}


function convertDegreesToNormalizedValue(degrees) {
    // Ensure that degrees is within the range [0, 359]
    degrees = (degrees % 360 + 360) % 360;

    // Normalize degrees to the range [0, 1]
    return degrees / 360;
}

function rotatePoint(x, y, originX, originY, angle) {
    // Convert the angle to radians
    var angleRad = angle * Math.PI / 180;

    // Calculate the new coordinates after rotation
    var newX = Math.cos(angleRad) * (x - originX) - Math.sin(angleRad) * (y - originY) + originX;
    var newY = Math.sin(angleRad) * (x - originX) + Math.cos(angleRad) * (y - originY) + originY;

    // Return the rotated coordinates
    return { x: newX, y: newY };
}


let main_tank_x = 0;
let main_tank_y = 0;
let barrel_rotation = 0;
const MAX_ROCKS = 3;
const MAX_Y_VALUE = 1;
const MAX_x_VALUE = 4;

function get_random_number_between(multipler){
    return (Math.random() * 2 - 1).toFixed(4) * multipler;
}



function check_quadrant(pos){
    if(pos<5 && pos>-5){
        return 0;
    }
    return Math.ceil((pos-5)/10)
}


bullets = []
let rocks = [];
for(let i = 0; i<10; i++){
    rocks.push({x : get_random_number_between(10), 
                y : get_random_number_between(10),
                size_x : get_random_number_between(.5)+1,
                size_y : get_random_number_between(.5)+1,
                rotation : get_random_number_between(1)+360
                });
}
console.log(rocks);
let counter = 0;
let mid_y = 0;
let mid_x = 0;
let last_mid_x = 0;
let last_mid_y = 0;

const NUMBER_OF_ROCKS_TO_ADD = 5;
function add_rocks_in_y(x, y){
    for(let i=0; i<NUMBER_OF_ROCKS_TO_ADD; i++){
        rocks.push({x : get_random_number_between(15)+x, 
                    y : get_random_number_between(5)+y,
                    size_x : get_random_number_between(.5)+1,
                    size_y : get_random_number_between(.5)+1,
                    rotation : get_random_number_between(1)+360
                    });
    }
}

function add_rocks_in_x(x, y){
    for(let i=0; i<NUMBER_OF_ROCKS_TO_ADD; i++){
        rocks.push({x : get_random_number_between(5)+x, 
                    y : get_random_number_between(15)+y,
                    size_x : get_random_number_between(.5)+1,
                    size_y : get_random_number_between(.5)+1,
                    rotation : get_random_number_between(1)+360
                    });
    }
}

function render( now ) {
    last_update = now;

    requestAnimationFrame( render );
    
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    render_ground(mid_x, mid_y);
    render_ground(mid_x+10, mid_y);
    render_ground(mid_x-10, mid_y);

    render_ground(mid_x, mid_y+10);
    render_ground(mid_x+10, mid_y+10);
    render_ground(mid_x-10, mid_y+10);

    render_ground(mid_x, mid_y-10);
    render_ground(mid_x+10, mid_y-10);
    render_ground(mid_x-10, mid_y-10);

    for(let i=0; i<rocks.length; i++){
        render_sphere(rocks[i].x, rocks[i].y, rocks[i].size_x, rocks[i].size_y, rocks[i].rotation);
    }

    main_tank_x = cam.x;
    main_tank_y = cam.y;
    if (barrel_rotation >= 360){
        barrel_rotation = 0;
    }

    render_tank_body(main_tank_x, main_tank_y);
    render_tank_cockpit(main_tank_x, main_tank_y);

    var point = rotatePoint(main_tank_x, main_tank_y+(BARREL_SCALE_Y/2), main_tank_x, main_tank_y, barrel_rotation);

    redner_tank_barrel( main_tank_x + (point.x - main_tank_x), main_tank_y + (point.y - main_tank_y), barrel_rotation);
}

const KEYMAP = {
    // 'KeyW': function() { cam.move_in_direction( 0, 0, FLY_SPEED_PER_FRAME ); },
    // 'KeyS': function() { cam.move_in_direction( 0, 0, -FLY_SPEED_PER_FRAME ); },
    'KeyA': function() { cam.move_in_direction( -FLY_SPEED_PER_FRAME, 0, 0 ); },
    'KeyD': function() { cam.move_in_direction( FLY_SPEED_PER_FRAME, 0, 0 ); },
    'KeyW': function() { cam.translate( 0, FLY_SPEED_PER_FRAME, 0 ); },
    'KeyS': function() { cam.translate( 0, -FLY_SPEED_PER_FRAME, 0 ); },
    // 'Space': function() { cam.translate( 0, FLY_SPEED_PER_FRAME, 0 ); },
    // 'KeyC': function() { cam.translate( 0, -FLY_SPEED_PER_FRAME, 0 ); },
    // 'KeyQ': function() { cam.add_roll( -ROTATION_SPEED_PER_FRAME ); },
    // 'KeyE': function() { cam.add_roll( ROTATION_SPEED_PER_FRAME ); },
    'ArrowLeft': function() { barrel_rotation += 3; },
    'ArrowRight': function() { barrel_rotation += -3; },
    // 'ArrowUp': function() { cam.add_pitch( -ROTATION_SPEED_PER_FRAME ); },
    // 'ArrowDown': function() { cam.add_pitch( ROTATION_SPEED_PER_FRAME ); },
};

function update() {
    let keys_down = keys.keys_down_list();

    mid_y = check_quadrant(main_tank_y) * 10;
    mid_x = check_quadrant(main_tank_x) * 10;
    if(mid_x != last_mid_x){
        add_rocks_in_x(mid_x+10, mid_y+10);
        last_mid_x = mid_x;
    }
    if(mid_y != last_mid_y){
        add_rocks_in_y(mid_x+10, mid_y+10);
        last_mid_y = mid_y;
    }
    
    for( const key of keys_down ) {
       let bound_function = KEYMAP[ key ];

       if( bound_function ) {
           bound_function();
       }
    }

    return;
}

requestAnimationFrame( render );
setInterval( update, DESIRED_MSPT );