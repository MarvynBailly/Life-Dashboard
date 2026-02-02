using Oxygen
using HTTP
using Dates
using CommonMark
using JSON

# --- CONFIGURATION ---
const LIFE_ROOT = "/home/pi/Life"
const PORT = 8081
const TEMPLATE_PATH = joinpath(@__DIR__, "template.html")

# Last.fm API Configuration
# Set your Last.fm username and API key here
const LASTFM_USER = get(ENV, "LASTFM_USER", "Nostrada_")
const LASTFM_API_KEY = get(ENV, "LASTFM_API_KEY", "b376056c0ce84c106b7ca53fb2b42cd2")

# --- DATA HELPERS ---
function get_todays_paths()
    d = now()
    day_dir = joinpath(LIFE_ROOT, string(year(d)), lpad(month(d), 2, '0'), lpad(day(d), 2, '0'))
    return (todo = joinpath(day_dir, "todo.md"), notes = joinpath(day_dir, "notes.md"))
end

function render_markdown(file_path)
    if !isfile(file_path)
        return "<p class='dim'>No notes file found for today.</p>"
    end
    try
        content = read(file_path, String)
        parser = CommonMark.Parser()
        CommonMark.enable!(parser, CommonMark.TableRule())
        CommonMark.enable!(parser, CommonMark.MathRule())
        ast = parser(content)
        # We explicitly use CommonMark.html here
        return CommonMark.html(ast)
    catch e
        return "<p style='color:red'>Error parsing markdown: $e</p>"
    end
end

function read_todos()
    path = get_todays_paths().todo
    items = []
    if isfile(path)
        lines = readlines(path)
        for (i, line) in enumerate(lines)
            # Match checkbox items and capture indentation
            m = match(r"^(\s*)-\s*\[([x>| ])\]\s*(.*)", line)
            if m !== nothing
                indent_level = length(m.captures[1]) ÷ 2  # Count spaces, divide by 2 for indent level
                status = m.captures[2]
                is_checked = (status == "x")
                is_moved = (status == ">")
                text = m.captures[3]
                push!(items, (
                    id=i, 
                    text=text, 
                    checked=is_checked,
                    moved=is_moved,
                    indent=indent_level,
                    line_num=i
                ))
            end
        end
    end
    return items
end

function get_todo_hierarchy()
    """Get hierarchical structure of todos for dropdown"""
    items = read_todos()
    hierarchy = []
    
    for item in items
        if item.indent == 0  # Only top-level items
            indent_str = ""
            push!(hierarchy, (id=item.id, text=item.text, indent_str=indent_str))
        end
    end
    
    return hierarchy
end

function toggle_todo(id::Int)
    path = get_todays_paths().todo
    if isfile(path)
        lines = readlines(path)
        if id <= length(lines) && id > 0
            line = lines[id]
            if occursin("[ ]", line)
                lines[id] = replace(line, "[ ]" => "[x]", count=1)
            else
                lines[id] = replace(line, "[x]" => "[ ]", count=1)
            end
            open(path, "w") do f
                for l in lines; println(f, l); end
            end
        end
    end
end

# --- HTML TEMPLATES ---
function load_template()
    if !isfile(TEMPLATE_PATH)
        error("Template file not found at: $TEMPLATE_PATH")
    end
    return read(TEMPLATE_PATH, String)
end

function page_layout(todo_html, notes_html)
    template = load_template()
    # Replace placeholders in template
    html = replace(template, "{{TODO_CONTENT}}" => todo_html)
    html = replace(html, "{{NOTES_CONTENT}}" => notes_html)
    return html
end

function render_todo_list()
    items = read_todos()
    if isempty(items)
        return "<p class='dim'>No tasks found for today.</p>"
    end
    
    html_out = ""
    for item in items
        checked_attr = item.checked ? "checked" : ""
        moved_attr = item.moved ? "moved" : ""
        class_attr = item.checked ? "checked" : (item.moved ? "moved" : "")
        indent_style = "margin-left: $(item.indent * 20)px;"
        
        html_out *= """
        <div class="todo-item $class_attr" 
             style="$indent_style"
             hx-post="/toggle/$(item.id)" 
             hx-target="#todo-list" 
             hx-swap="innerHTML">
            <input type="checkbox" $checked_attr>
            <span>$(item.text)</span>
        </div>
        """
    end
    return html_out
end

# --- HANDLERS (With Ambiguity Fixed) ---

function api_home(req)
    try
        todos = render_todo_list()
        notes_path = get_todays_paths().notes
        notes = render_markdown(notes_path)
        
        html_response = page_layout(todos, notes)
        
        # Return response quickly to avoid broken pipe
        return Oxygen.html(html_response)
    catch e
        @error "Error in api_home" exception=e
        return text("Error loading page: $(sprint(showerror, e))")
    end
end

function api_toggle_task(req, id)
    try
        todo_id = parse(Int, id)
        toggle_todo(todo_id)
        
        # FIX: Explicitly call Oxygen.html
        return Oxygen.html(render_todo_list())
    catch e
        return text("Error toggling task: $(sprint(showerror, e))")
    end
end

# --- LAST.FM INTEGRATION ---
function fetch_now_playing()
    url = "http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=$(LASTFM_USER)&api_key=$(LASTFM_API_KEY)&format=json&limit=1"
    
    try
        response = HTTP.get(url, readtimeout=5, connect_timeout=5)
        data = JSON.parse(String(response.body))
        
        # Check if there are any recent tracks
        if haskey(data, "recenttracks") && haskey(data["recenttracks"], "track")
            tracks = data["recenttracks"]["track"]
            
            # Handle both single track (dict) and multiple tracks (array)
            track = tracks isa Array ? tracks[1] : tracks
            
            # Extract track info
            title = get(track, "name", "Unknown Track")
            artist = get(get(track, "artist", Dict()), "#text", "Unknown Artist")
            
            # Get album art (prefer large size)
            album_art = "https://via.placeholder.com/300x300/1e1e1e/666?text=No+Art"
            if haskey(track, "image")
                images = track["image"]
                for img in images
                    if img["size"] == "extralarge" && !isempty(img["#text"])
                        album_art = img["#text"]
                        break
                    elseif img["size"] == "large" && !isempty(img["#text"])
                        album_art = img["#text"]
                    end
                end
            end
            
            return Dict(
                "title" => title,
                "artist" => artist,
                "album_art" => album_art
            )
        else
            return Dict(
                "title" => "Nothing playing",
                "artist" => "No recent tracks found",
                "album_art" => "https://via.placeholder.com/300x300/1e1e1e/666?text=No+Music"
            )
        end
    catch e
        @error "Failed to fetch Last.fm data" exception=e
        return Dict(
            "title" => "Error loading track",
            "artist" => "Could not connect to Last.fm",
            "album_art" => "https://via.placeholder.com/300x300/1e1e1e/666?text=Error"
        )
    end
end

function api_now_playing(req)
    data = fetch_now_playing()
    return json(data)
end

# --- ADD NOTE HANDLER ---
function api_add_note(req)
    try
        body = json(req)
        title = get(body, "title", "")
        content = get(body, "content", "")
        
        if isempty(title) || isempty(content)
            return json(Dict("error" => "Title and content are required"), 400)
        end
        
        notes_path = get_todays_paths().notes
        
        # Create directory if it doesn't exist
        mkpath(dirname(notes_path))
        
        # Append new note to the file
        open(notes_path, "a") do f
            println(f, "\n## $title\n")
            println(f, content)
        end
        
        return json(Dict("success" => true))
    catch e
        @error "Error adding note" exception=e
        return json(Dict("error" => "Failed to add note: $(sprint(showerror, e))"), 500)
    end
end

# --- ADD TODO HANDLER ---
function api_add_todo(req)
    try
        body = json(req)
        text = get(body, "text", "")
        parent_id = get(body, "parent_id", nothing)
        
        if isempty(text)
            return json(Dict("error" => "Task text is required"), 400)
        end
        
        todo_path = get_todays_paths().todo
        
        # Create directory and file if they don't exist
        mkpath(dirname(todo_path))
        if !isfile(todo_path)
            open(todo_path, "w") do f
                println(f, "# To Do")
            end
        end
        
        lines = readlines(todo_path)
        
        # Determine indent level and insertion position
        indent = 0
        insert_pos = length(lines) + 1
        
        if parent_id !== nothing
            # Find parent task and insert as child
            parent_line = parse(Int, parent_id)
            if parent_line > 0 && parent_line <= length(lines)
                # Get parent indent
                parent_match = match(r"^(\s*)-\s*\[", lines[parent_line])
                if parent_match !== nothing
                    parent_indent = length(parent_match.captures[1])
                    indent = parent_indent + 2
                    
                    # Find where to insert (after parent and its children)
                    insert_pos = parent_line + 1
                    while insert_pos <= length(lines)
                        line = lines[insert_pos]
                        m = match(r"^(\s*)-\s*\[", line)
                        if m !== nothing
                            line_indent = length(m.captures[1])
                            if line_indent <= parent_indent
                                break
                            end
                        elseif !isempty(strip(line)) && !startswith(line, "#")
                            break
                        end
                        insert_pos += 1
                    end
                end
            end
        else
            # Add at top level, find first "# To Do" section
            for (i, line) in enumerate(lines)
                if startswith(line, "# To Do")
                    insert_pos = i + 1
                    break
                end
            end
        end
        
        # Create new task line
        indent_str = " " ^ indent
        new_line = "$(indent_str)- [ ] $text"
        
        # Insert the new task
        insert!(lines, insert_pos, new_line)
        
        # Write back to file
        open(todo_path, "w") do f
            for line in lines
                println(f, line)
            end
        end
        
        return json(Dict("success" => true))
    catch e
        @error "Error adding todo" exception=e
        return json(Dict("error" => "Failed to add todo: $(sprint(showerror, e))"), 500)
    end
end

# --- GET TODO HIERARCHY ---
function api_get_hierarchy(req)
    try
        hierarchy = get_todo_hierarchy()
        return json(hierarchy)
    catch e
        @error "Error getting hierarchy" exception=e
        return json(Dict("error" => "Failed to get hierarchy"), 500)
    end
end

# --- STATIC FILE HANDLER ---
function serve_static_file(req, filename)
    filepath = joinpath(@__DIR__, filename)
    
    if !isfile(filepath)
        return text("File not found", 404)
    end
    
    # Determine content type
    content_type = if endswith(filename, ".css")
        "text/css"
    elseif endswith(filename, ".js")
        "application/javascript"
    else
        "text/plain"
    end
    
    content = read(filepath, String)
    return HTTP.Response(200, ["Content-Type" => content_type], body=content)
end

# --- QUOTES HANDLER ---
function api_get_quotes(req)
    try
        quotes = []
        
        # Fetch Kanye quote
        try
            kanye_response = HTTP.get("https://api.kanye.rest", readtimeout=3, connect_timeout=3)
            kanye_data = JSON.parse(String(kanye_response.body))
            push!(quotes, Dict(
                "text" => get(kanye_data, "quote", ""),
                "author" => "Kanye West",
                "source" => "kanye.rest"
            ))
        catch e
            @warn "Failed to fetch Kanye quote" exception=e
        end
        
        return json(quotes)
    catch e
        @error "Error getting quotes" exception=e
        return json(Dict("error" => "Failed to get quotes"), 500)
    end
end

# --- LAYOUT PERSISTENCE ---
const LAYOUT_FILE = joinpath(@__DIR__, "dashboard_layout.json")

function api_save_layout(req)
    try
        body = json(req)
        
        @info "Saving layout to: $LAYOUT_FILE"
        @info "Layout data: $(keys(body))"
        
        # Save layout to file
        open(LAYOUT_FILE, "w") do f
            JSON.print(f, body, 2)
        end
        
        @info "Layout saved successfully"
        
        return json(Dict("status" => "success"))
    catch e
        @error "Error saving layout" exception=(e, catch_backtrace())
        return json(Dict("error" => "Failed to save layout: $(sprint(showerror, e))"), 500)
    end
end

function api_load_layout(req)
    try
        if isfile(LAYOUT_FILE)
            layout = JSON.parsefile(LAYOUT_FILE)
            return json(layout)
        else
            return json(Dict())
        end
    catch e
        @error "Error loading layout" exception=e
        return json(Dict("error" => "Failed to load layout"), 500)
    end
end

# --- ROUTES ---
@get "/" api_home
@post "/toggle/{id}" api_toggle_task
@get "/nowplaying" api_now_playing
@post "/addnote" api_add_note
@post "/addtodo" api_add_todo
@get "/hierarchy" api_get_hierarchy
@get "/quotes" api_get_quotes
@post "/savelayout" api_save_layout
@get "/loadlayout" api_load_layout
@get "/styles.css" req -> serve_static_file(req, "styles.css")
@get "/app.js" req -> serve_static_file(req, "app.js")

# --- START SERVER ---
serve(host="0.0.0.0", port=PORT)