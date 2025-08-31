from google import genai
from dotenv import load_dotenv
import os
import pathlib
from google.genai import types
import json

load_dotenv()

def load_user_inputs():
    """Load user inputs from file if exists"""
    config_file = "user_config.json"
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return None
    return None


def save_user_inputs(user_name, user_id, difficulty_level, duration, teaching_style):
    """Save user inputs to file"""
    config_file = "user_config.json"
    config_data = {
        "user_name": user_name,
        "user_id": user_id,
        "difficulty_level": difficulty_level,
        "duration": duration,
        "teaching_style": teaching_style
    }
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2)
    except:
        pass


def get_gemini_client() -> genai.Client:
    """Return an authenticated Gemini client using GEMINI_API_KEY from env."""
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def get_google_search_tool() -> genai.types.Tool:
    """Return a Google Search tool usable by Gemini for grounding."""
    return genai.types.Tool(google_search=genai.types.GoogleSearch())


system_prompt = """You are a course design assistant.

You will be provided with the following **mandatory inputs**:
1. A **curriculum document** in PDF format containing existing course content (e.g., syllabi, outlines, topics, activities, or readings)
2. A **course topic or name** describing what the learner or instructor wants the course to focus on
3. A selected **difficulty level** (see below)
4. A selected **teaching style** (see below) 
5. A selected **duration** (see below)

---

## 🔹 Your responsibilities:

### 1. Analyze the provided course topic:
- Identify the key subject area, sub-domains, and intended focus
- Determine any implied target audience or specialization
- Use the title or topic to scope the content direction

### 2. Extract and analyze the curriculum PDF:
- Understand the course structure, core topics, objectives, and flow
- Identify key concepts, modules, teaching methods, assessments, and learning outcomes
- Extract reusable content relevant to the course topic
- Adapt teaching methodologies where possible to align with the selected teaching style

### 3. Integrate teaching style and difficulty level into all outputs:

#### ✅ Teaching Style (one selected, plus one default):

The user will select **one of the following** teaching styles:
- **Exploratory & Guided**: Encourage curiosity, pose questions, and guide learners to discover insights through problems or case studies.
- **Project-Based / Hands-On**: Focus on real-world tasks, projects, or examples. Ideal for teaching by doing and skill development.
- **Conceptual & Conversational**: Break down complex ideas using analogies and clear, friendly language. Great for simplifying tough concepts.

In **all cases**, you must also apply:
- **Clear & Structured** (default): Explain topics step-by-step in a logical, structured way. Use progressive layering of complexity to clarify concepts.

> 🔸 Each module should reflect **both** the Clear & Structured approach **and** the selected secondary style.

#### ✅ Difficulty Level (one required input):
- **Foundational**: No prior knowledge needed. Teaches core concepts, terms, and workflows with relatable examples and visuals. Ideal for early learners.
- **Intermediate**: Assumes basic familiarity. Builds understanding through structured applications, real-world cases, and layered explanations.
- **Advanced**: For experienced learners. Explores research insights, edge cases, system-level thinking, and implementation depth.

> 🔸 The difficulty level affects **content depth, tone, resource complexity, and expectations for outcomes**.

---

### 4. Design a modular course outline that:

- Matches the course topic and reflects extracted curriculum structure
- Contains 6–10 weekly or unit-based modules
- Clearly defines goals, key concepts, and expected outcomes for each module
- Integrates content from the curriculum wherever relevant
- Adapts structure and language to the selected teaching style and difficulty level

---

### 5. For each module, include:

- **Title and learning objectives**
- **Key concepts and skills to be covered**
- **Instructional activities or methods**, reflecting the selected teaching style and Clear & Structured flow
- **Integration of curriculum-based materials**, adapted for the course context
- **Real-time online resources**, found using live Google Search (include URLs + brief descriptions)
- **Suggestions for assessments, exercises, or projects** aligned with level and style

---

### 6. Format your output in clean, readable **Markdown**, using:

- Section headers
- Bullet points
- Clear structure per module
- Summary or final assessment if applicable

---

### 7. At the end of your output, generate a **system prompt for a Teaching Agent**, based on the designed course. This prompt should instruct the agent to:

- Use the course outline to support learners
- Answer questions based on specific module content
- Suggest supplemental readings and resources
- Adapt its communication to the teaching style and difficulty level
- Help students prepare for module activities and assessments

---

## 🧠 Your goal:
Create a **cohesive, learner-aligned course plan** that:
- Bridges user goals and curriculum source material
- Incorporates modern pedagogy through style and difficulty adaptation
- Delivers a strong modular structure and curated web content
- Enables AI teaching support via a follow-up agent prompt

Respond only after carefully analyzing all inputs and formatting the final course plan in structured Markdown."""


def generate_course_content(client, teaching_style, duration, difficulty_level, google_search_tool, system_prompt, filepath=None, course_content=None, task=None):
    """
    Generate course content using the LLM
    
    Args:
        client: The Gemini client instance
        teaching_style: Teaching style preference
        duration: Course duration
        difficulty_level: Difficulty level
        google_search_tool: Google search tool for the LLM
        system_prompt: System instruction for the LLM
        filepath: Optional path to PDF file to include
        course_content: Optional text content to include (for quiz generation, etc.)
        task: Optional specific task description
        
    Returns:
        Generated response from the LLM
    """
    # Build contents list properly - all content should be strings
    contents = [
        f"Teaching Style: {teaching_style}",
        f"Duration: {duration}",
        f"Difficulty Level: {difficulty_level}"
    ]
    
    # Add course content if provided (for quiz generation, analysis, etc.)
    if course_content:
        contents.append(f"COURSE CONTENT:\n{course_content}")
    
    # Add task description if provided
    if task:
        contents.append(f"TASK: {task}")
    
    # Add PDF content only if filepath is provided and file exists
    if filepath and filepath.exists():
        contents.append(types.Part.from_bytes(
            data=filepath.read_bytes(),
            mime_type='application/pdf',
        ))
    
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=contents,
        config=genai.types.GenerateContentConfig(
            tools=[google_search_tool],
            system_instruction=system_prompt,
        ),
    )
    return response


def _run_standalone():
    """Standalone execution to produce planner_agent_instruction.txt (preserves old behavior)."""
    # Try to load existing user inputs
    saved_inputs = load_user_inputs()

    if saved_inputs:
        print("Using saved user configuration:")
        print(f"User Name: {saved_inputs['user_name']}")
        print(f"User ID: {saved_inputs['user_id']}")
        print(f"Difficulty Level: {saved_inputs['difficulty_level']}")
        print(f"Duration: {saved_inputs['duration']}")
        print(f"Teaching Style: {saved_inputs['teaching_style']}")

        user_name = saved_inputs['user_name']
        user_id = saved_inputs['user_id']
        difficulty_level = saved_inputs['difficulty_level']
        duration = saved_inputs['duration']
        teaching_style = saved_inputs['teaching_style']
        print("Using existing configuration.")
    else:
        print("First time setup - please provide your details:")

        while True:
            user_name = input("Give a user name: ")
            if user_name.strip() == "":
                print("User name cannot be empty. Please enter a valid name.")
            else:
                break

        while True:
            user_id = input("Give a user ID (Example: user_id_5678): ")
            if user_id.strip() == "":
                print("User ID cannot be empty. Please enter a valid ID.")
            else:
                break

        difficulty_level = input("Enter the difficulty level (Foundational, Intermediate, Advanced): ")
        if difficulty_level.lower() in ['none', ''] or difficulty_level.lower() not in ['foundational', 'intermediate', 'advanced']:
            difficulty_level = "Foundational"  # Default to Foundational if none specified

        while True:
            duration = input("Enter the desired duration for the course (e.g., 4 weeks, 8 weeks): ")
            if duration == "" or duration.lower() == "none":
                print("Duration cannot be empty. Please enter a valid duration.")
            else:
                break

        teaching_style = input("Enter preferred teaching style (e.g., Exploratory & Guided, Project-Based / Hands-On, Conceptual & Conversational): ")
        if teaching_style.lower() == "none":
            teaching_style = "Exploratory & Guided"  # Default to Exploratory & Guided if none specified

        # Save inputs for future runs
        save_user_inputs(user_name, user_id, difficulty_level, duration, teaching_style)
        print("Configuration saved for future runs.")

    print("Thank you for providing the inputs. Processing your request...")

    client = get_gemini_client()
    google_search_tool = get_google_search_tool()

    try:
        filepath = pathlib.Path("Inputs and Outputs/curriculum.pdf")
        response = generate_course_content(
            client,
            teaching_style,
            duration,
            difficulty_level,
            google_search_tool,
            system_prompt,
            filepath,
        )

        print(response.text)

        # Save the response to a text file for the master agent
        output_file_path = "Inputs and Outputs/planner_agent_instruction.txt"
        try:
            with open(output_file_path, 'w', encoding='utf-8') as f:
                f.write(response.text)
            print(f"\nResponse saved to: {output_file_path}")
        except Exception as e:
            print(f"Error saving response to file: {e}")

        # Optional: Print grounding metadata if available
        if response.candidates:
            for candidate in response.candidates:
                if candidate.grounding_metadata and candidate.grounding_metadata.web_search_queries:
                    print("\n--- Grounding Metadata ---")
                    print("Web Search Queries:", candidate.grounding_metadata.web_search_queries)
                    if candidate.grounding_metadata.grounding_chunks:
                        print("Grounding Chunks (Web):")
                        for chunk in candidate.grounding_metadata.grounding_chunks:
                            if chunk.web:
                                print(f"  - Title: {chunk.web.title}, URL: {chunk.web.uri}")
    except Exception as e:
        print(f"An error occurred during LLM interaction: {e}")


if __name__ == "__main__":
    _run_standalone()