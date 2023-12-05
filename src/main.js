let canvas = document.getElementById( 'the-canvas' );
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
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
    new LitMaterial( gl, 'tex/extreme_rock.jpg', gl.LINEAR, 0.25, 1, 2, 5 );
let grass_texture = 
    new LitMaterial( gl, 'tex/grass2.jpg', gl.LINEAR, 0.2, 0.8, 0.05, 1.0 );
let scale = 
    new LitMaterial( gl, 'tex/metal_scale.png', gl.LINEAR, 0.25, 1, 2, 4 );
let blue = 
    new LitMaterial( gl, 'tex/extreme_blue.png', gl.LINEAR, 0.25, 1, 2, 4 );

let red = new LitMaterial( gl, 'tex/extreme_red.jpg', gl.LINEAR, 0.25, 1, 2, 4 );


let rock = NormalMesh.uv_sphere( gl, lit_program, 1, 16, rock_texture ); 
let ground = NormalMesh.box( gl, lit_program, 1, 1, 1, grass_texture );
let tank_body = NormalMesh.box( gl, lit_program, 1, 1, 1, scale );
let tank_cockpit = NormalMesh.uv_sphere( gl, lit_program, 1, 16, scale );
let bullet = NormalMesh.uv_sphere( gl, lit_program, 1, 16, blue );
let enemy = NormalMesh.real_box( gl, lit_program, 1, 1, 1, red );


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


    let light1 = null;
    let sun_dir = ( new Vec4( sun_cords_x, 0.0, sun_cords_z, 0.0 ) ).norm();
    let sun = new Light( sun_dir.x, sun_dir.y, sun_dir.z, 1.0, 0.95, 0.85, 0 );
    if (sun_cords_z>0){
        light1 = new Light( main_tank_x, main_tank_y, 0.0, 0.2, 0.4, 1.0, 1 );
    }
    else{
        light1 = new Light( main_tank_x, main_tank_y, 0.0, 0.0, 0.0, 0.0, 1 );
    }
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

const BULLET_SCALE_Z = 1;
const BULLET_TRANSLATION_Z = -0.5;
const BULLET_SIZE = .04;
function render_bullet(x, y){
    let scale_matrix = Mat4.scale(BULLET_SIZE, BULLET_SIZE, BULLET_SIZE);
    let rotation_matrix = Mat4.rotation_xy(0.0);
    let translation_matrix = Mat4.translation(x, y, BULLET_TRANSLATION_Z );
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    bullet.render( gl );
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
    let rotation_matrix = Mat4.rotation_xy(degrees_to_normalized(-rotation_deg));
    let translation_matrix = Mat4.translation(x, y, BARREL_TRANSLATION_Z);
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    tank_body.render( gl );
}


function render_tank(x, y, rotation){
    render_tank_body(x, y);
    render_tank_cockpit(x, y)
    barrel_point = rotate_around_point(main_tank_x, main_tank_y+(BARREL_SCALE_Y/2), main_tank_x, main_tank_y, rotation);
    redner_tank_barrel( main_tank_x + (barrel_point.x - main_tank_x), main_tank_y + (barrel_point.y - main_tank_y), rotation);
}

const ENEMY_SIZE = .4;
const ENEMY_Z_TRANSLATION =  -.12;
function render_enemies(x, y){
    let scale_matrix = Mat4.scale(ENEMY_SIZE, ENEMY_SIZE, 1);
    let rotation_matrix = Mat4.rotation_xy(0.0);
    let translation_matrix = Mat4.translation(x, y, ENEMY_Z_TRANSLATION );
    let model = translation_matrix.mul(rotation_matrix.mul(scale_matrix));
    set_and_bind(model);
    enemy.render( gl );

}

function degrees_to_normalized(degrees) {
    return ((degrees % 360 + 360)) % 360 / 360;
}

function rotate_around_point(x, y, origin_x, origin_y, angle) {
    let rad = angle * Math.PI / 180;
    return { x: Math.cos(rad) * (x - origin_x) - Math.sin(rad) * (y - origin_y) + origin_x,
             y: Math.sin(rad) * (x - origin_x) + Math.cos(rad) * (y - origin_y) + origin_y 
            };
}

function get_random_number_between(multipler){
    return (Math.random() * 2 - 1).toFixed(4) * multipler;
}

function is_not_stail_asset(cur_x, cur_y, rock_x, rock_y, distance_threshold){
    if (Math.abs(cur_x-rock_x) > distance_threshold){
        return false;
    }
    if (Math.abs(cur_y-rock_y) > distance_threshold){
        return false;
    }
    return true;
}

function check_quadrant(pos){
    if(pos<5 && pos>-5){
        return 0;
    }
    return Math.ceil((pos-5)/10)
}

let rocks = [];
const STARTING_NUM_ROCKS = 10;
for(let i = 0; i<STARTING_NUM_ROCKS; i++){
    rocks.push({x : get_random_number_between(15), 
                y : get_random_number_between(15),
                size_x : get_random_number_between(.5)+1,
                size_y : get_random_number_between(.5)+1,
                rotation : get_random_number_between(1)*360
                });
}


let enemies = [];
const STARTING_NUM_ENEMIES = 5;
for(let i = 0; i<STARTING_NUM_ROCKS; i++){
    enemies.push({x : get_random_number_between(15), 
                  y : get_random_number_between(15),
                  x_step : 0,
                  y_step : 0,
                  move_counter : 0
                });
}


let main_tank_x = 0;
let main_tank_y = 0;
let barrel_rotation = 0;
const MAX_ROCKS = 3;
const MAX_Y_VALUE = 1;
const MAX_x_VALUE = 4;

let tme_counter = 0;
let bullets = [];
let barrel_point = null;

let sun_cords_x = -1
let sun_cords_z = -1

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
                    rotation : get_random_number_between(1)*360
                    });
    }
}

function add_rocks_in_x(x, y){
    for(let i=0; i<NUMBER_OF_ROCKS_TO_ADD; i++){
        rocks.push({x : get_random_number_between(5)+x, 
                    y : get_random_number_between(15)+y,
                    size_x : get_random_number_between(.5)+1,
                    size_y : get_random_number_between(.5)+1,
                    rotation : get_random_number_between(1)*360
                    });
    }
}

const NUMBER_OF_ENEMIES_TO_ADD = 5;
function add_enemies_in_y(x, y){
    for(let i=0; i<NUMBER_OF_ENEMIES_TO_ADD; i++){
        enemies.push({x : get_random_number_between(15)+x, 
                     y : get_random_number_between(5)+y,
                     x_step : 0,
                     y_step : 0,
                     move_counter : 0
                    });
    }
}

function add_enemies_in_x(x, y){
    for(let i=0; i<NUMBER_OF_ENEMIES_TO_ADD; i++){
        enemies.push({x : get_random_number_between(5)+x, 
                     y : get_random_number_between(15)+y,
                     x_step : 0,
                     y_step : 0,
                     move_counter : 0
                    });
    }
}


function circle_and_square_intersecting(circle_x, circle_y, circle_size, square_x, square_y, square_length) {
    const half_square_length = square_length / 2;
    if (Math.abs(circle_x - square_x) <= (circle_size / 2 + half_square_length) && Math.abs(circle_y - square_y) <= (circle_size / 2 + half_square_length))
        return true;
    return false;
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

    render_tank(main_tank_x, main_tank_y, barrel_rotation)

    for(let i=0; i<bullets.length; i++)
        render_bullet(bullets[i].x, bullets[i].y);

    for(let i=0; i<enemies.length; i++)
        render_enemies(enemies[i].x, enemies[i].y, enemies[i].rotation);

}

let SUN_SPEED = .1;

const KEYMAP = {
    // 'KeyW': function() { cam.move_in_direction( 0, 0, FLY_SPEED_PER_FRAME ); },
    // 'KeyS': function() { cam.move_in_direction( 0, 0, -FLY_SPEED_PER_FRAME ); },
    'KeyA': function() { cam.move_in_direction( -FLY_SPEED_PER_FRAME, 0, 0 ); },
    'KeyD': function() { cam.move_in_direction( FLY_SPEED_PER_FRAME, 0, 0 ); },
    'KeyW': function() { cam.translate( 0, FLY_SPEED_PER_FRAME, 0 ); },
    'KeyS': function() { cam.translate( 0, -FLY_SPEED_PER_FRAME, 0 ); },
    'KeyQ': function() { SUN_SPEED = .01},
    // 'KeyC': function() { cam.translate( 0, -FLY_SPEED_PER_FRAME, 0 ); },
    // 'KeyQ': function() { cam.add_roll( -ROTATION_SPEED_PER_FRAME ); },
    // 'KeyE': function() { cam.add_roll( ROTATION_SPEED_PER_FRAME ); },
    'ArrowLeft': function() { barrel_rotation += 3; },
    'ArrowRight': function() { barrel_rotation += -3; },
    // 'ArrowUp': function() { cam.add_pitch( -ROTATION_SPEED_PER_FRAME ); },
    // 'ArrowDown': function() { cam.add_pitch( ROTATION_SPEED_PER_FRAME ); },
};

const BULLET_SPEED = .04; // smaller slower
const RATE_OF_FIRE = 50; // lower faster
const BULLETS_LIMIT = 2;


let bullet_to_check = 0;
function update() {
    // console.log("rocks length = ", rocks.length);
    // console.log("bullets length = ", bullets.length);
    // console.log("enemies length = ", enemies.length);

    for (let j = 0; j < bullets.length; j++) {
        enemies = enemies.filter(enemy => !circle_and_square_intersecting(bullets[j].x, bullets[j].y, BULLET_SIZE, enemy.x, enemy.y, ENEMY_SIZE));
    }

    let keys_down = keys.keys_down_list();

    const MOVE_COUNT_MAX = 50;
    for(let i=0; i<enemies.length; i++){
        enemies[i].x += enemies[i].x_step;
        enemies[i].y += enemies[i].y_step;
        if(enemies[i].move_counter>MOVE_COUNT_MAX){
            enemies[i].move_counter = 0;
            enemies[i].x_step = get_random_number_between(1) * FLY_SPEED_PER_FRAME/2;
            enemies[i].y_step = get_random_number_between(1) * FLY_SPEED_PER_FRAME/2;
        }
        enemies[i].move_counter++;
    }


    if (barrel_rotation >= 360){
        barrel_rotation = 0;
    }

    if(bullets.length> BULLETS_LIMIT){
        bullets.shift();
    }


    for(let i=0; i<bullets.length; i++){
        bullets[i].x += bullets[i].norm_vec.x * BULLET_SPEED;
        bullets[i].y += bullets[i].norm_vec.y * BULLET_SPEED;
    }

    tme_counter++;
    if(tme_counter == 50){
        tme_counter = 0;
        barrel_point = rotate_around_point(main_tank_x, main_tank_y+(BARREL_SCALE_Y/2), main_tank_x, main_tank_y, barrel_rotation);
        barrel_norm = new Vec4(barrel_point.x - main_tank_x, barrel_point.y - main_tank_y, 0).norm();
        bullets.push({x : main_tank_x + (barrel_norm.x * BARREL_SCALE_Y),
                      y : main_tank_y + (barrel_norm.y * BARREL_SCALE_Y),
                    norm_vec : barrel_norm})
    }

    let cur_sun_pos = rotate_around_point(sun_cords_x, sun_cords_z, 0, 0, SUN_SPEED);
    sun_cords_x = cur_sun_pos.x;
    sun_cords_z = cur_sun_pos.y;

    mid_y = check_quadrant(main_tank_y) * 10;
    mid_x = check_quadrant(main_tank_x) * 10;

    if(mid_x != last_mid_x){
        rocks = rocks.filter(rock => is_not_stail_asset(main_tank_x, main_tank_y, rock.x, rock.y, 15));
        enemies = enemies.filter(enemy => is_not_stail_asset(main_tank_x, main_tank_y, enemy.x, enemy.y, 15));
        add_rocks_in_x(mid_x+10, mid_y+10);
        add_enemies_in_x(mid_x+10, mid_y+10);
        last_mid_x = mid_x;
    }

    if(mid_y != last_mid_y){
        rocks = rocks.filter(rock => is_not_stail_asset(main_tank_x, main_tank_y, rock.x, rock.y, 15));
        enemies = enemies.filter(enemy => is_not_stail_asset(main_tank_x, main_tank_y, enemy.x, enemy.y, 15));
        add_rocks_in_y(mid_x+10, mid_y+10);
        add_enemies_in_y(mid_x+10, mid_y+10);
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